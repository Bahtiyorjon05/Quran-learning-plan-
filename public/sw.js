/**
 * Ahd's service worker.
 *
 * Deliberately small, and deliberately not a blanket cache. Three kinds of
 * request behave in three different ways, because caching them alike would be
 * wrong for at least two of them:
 *
 *   pages        network first. A page carries today's sheet, a streak, a
 *                covenant — all of which change. Serving yesterday's from a
 *                cache would be showing someone stale facts about their own
 *                progress. The cached copy exists only for when the network is
 *                gone, which is exactly when it is worth having.
 *
 *   static       cache first. Hashed filenames from /_next/static never change
 *                content, so revalidating them is pure latency.
 *
 *   recitation   cache first, and kept. An ayah's audio is immutable and the
 *                same verses get replayed twenty times while a page is learned;
 *                fetching them again on a metered phone would be careless.
 *
 * Anything else — API routes, server actions, the database — is never cached.
 * A stale answer to "did my page save" is worse than no answer.
 */

const VERSION = "ahd-v3";

/* Pages behind the sign-in, which are never written to the cache.

   Everything under these is personal — a name, a covenant, a progress figure,
   an email address on the settings screen. The download path already refuses
   to keep the signed-in reader for exactly this reason ("caching it would put
   one person's progress in front of whoever picks up the device next"), but
   the runtime cache was keeping every page anybody navigated to, this included,
   and nothing cleared it at sign-out. A borrowed phone in aeroplane mode
   showed the last person's dashboard.

   The version above is bumped alongside this, so any copy an older worker kept
   is dropped on activation rather than lingering for the life of the install. */
const PRIVATE = /^(?:\/(?:en|ru))?\/(?:app|admin)(?:\/|$)/;
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const AUDIO = `${VERSION}-audio`;

/**
 * Recitation somebody asked to keep.
 *
 * Deliberately not versioned, and deliberately never trimmed. The two caches
 * above are the app's own workings and are thrown away when a new build lands;
 * this one holds files a person chose to download onto their phone, sometimes
 * over an expensive connection, and losing those to a deploy they never asked
 * for would be indefensible. It shrinks only when they say so.
 *
 * The name is duplicated in src/lib/offline-audio.ts, because a service worker
 * cannot import from the app. A test holds the two together.
 */
const SAVED = "ahd-audio-saved";

/** Recitation is immutable but not unbounded; a full mushaf is a lot of mp3s. */
/* Roughly a juz of listening kept on the device. Each ayah is a small mp3,
   and 300 of them was about twenty pages — enough to be surprised by silence
   on a train. Still bounded, because an unbounded audio cache on a phone is
   how an app gets deleted. */
const AUDIO_LIMIT = 1500;

self.addEventListener("install", (event) => {
  /* Two pages worth having before they are needed: the one that explains what
     has happened, and the index it sends people to. Without the second, the
     only button on the offline page led somewhere that had never been cached,
     so pressing it did nothing at all. */
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) =>
        Promise.all([
          cache.add("/offline").catch(() => {}),
          cache.add("/quran").catch(() => {}),
        ]),
      )
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== SAVED && !name.startsWith(VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Trim a cache to its most recent entries, oldest first. */
async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  /* Only ever GET. A POST is a server action or a form, and replaying one from
     a cache would repeat somebody's answer. */
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* ── Recitation ── */
  if (url.hostname === "cdn.islamic.network" || url.hostname.endsWith("mp3quran.net")) {
    event.respondWith(
      (async () => {
        /* What was downloaded on purpose is looked at first: it is the copy a
           person is relying on, and the rolling cache may have evicted its
           own. */
        const saved = await caches.open(SAVED);
        const kept = await saved.match(request);
        if (kept) return kept;

        const cache = await caches.open(AUDIO);
        const hit = await cache.match(request);
        if (hit) return hit;

        const response = await fetch(request);
        /* 206 is a range request — the browser asked for part of a file, and a
           partial response cached whole would play as a fragment. */
        if (response.ok && response.status === 200) {
          cache.put(request, response.clone());
          trim(AUDIO, AUDIO_LIMIT);
        }
        return response;
      })(),
    );
    return;
  }

  /* Nothing cross-origin beyond that. */
  if (url.origin !== self.location.origin) return;

  /* ── Immutable build output ── */
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(request);
        if (hit) return hit;

        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  /* Never the API, and never a server action. */
  if (url.pathname.startsWith("/api/")) return;

  /* ── Pages ── */
  if (request.mode === "navigate") {
    const personal = PRIVATE.test(url.pathname);

    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          /* Signed-in pages are served and forgotten. */
          if (personal) return response;
          /* `cache.put` refuses a redirected response, and locale routing means
             plenty of these arrive that way — so the copy that is kept is
             rebuilt from the body. Without this the put rejected quietly and
             the page was never cached at all, which is why a reader who had
             opened a page still found nothing there offline. */
          if (response.ok) {
            const cache = await caches.open(PAGES);
            const copy = response.clone();
            const keep = copy.redirected
              ? new Response(await copy.blob(), {
                  status: 200,
                  statusText: "OK",
                  headers: copy.headers,
                })
              : copy;
            cache.put(request, keep).catch(() => {});
          }
          return response;
        } catch {
          /* Downloaded on purpose first, then merely visited, then the page
             that explains what has happened.

             The first of those is the whole point of a download: a reader who
             asked for a surah before getting on a train has never opened most
             of its pages, so "seen before" would have nothing for them. */
          const saved = await caches.open(SAVED);
          const kept = await saved.match(request, { ignoreSearch: true });
          if (kept) return kept;

          /* A signed-in reader's links point at /app/quran/N, but what a
             download stores is the public /quran/N — deliberately, because the
             signed-in page is personalised and caching it would put one
             person's progress in front of whoever picks up the device next.
             The words are the same either way, so offline the public copy
             stands in rather than nothing at all. */
          const app = url.pathname.match(/^(?:\/(?:en|ru))?\/app\/quran\/(\d+)$/);
          if (app) {
            const locale = url.pathname.startsWith("/en")
              ? "/en"
              : url.pathname.startsWith("/ru")
                ? "/ru"
                : "";
            const publicCopy = await saved.match(`${url.origin}${locale}/quran/${app[1]}`, {
              ignoreSearch: true,
            });
            if (publicCopy) return publicCopy;
          }

          const cache = await caches.open(PAGES);
          return (
            (await cache.match(request)) ??
            (await cache.match("/offline")) ??
            new Response("", { status: 504 })
          );
        }
      })(),
    );
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   PUSH
   The only part of this worker that runs when nobody has the app open. A push
   arrives encrypted to a key this browser alone holds, is decrypted here, and
   must result in a visible notification — every browser revokes permission
   from a site that receives pushes and shows nothing.
   ═══════════════════════════════════════════════════════════════════════════ */

self.addEventListener("push", (event) => {
  /* A push with no payload, or one that is not ours, still has to become
     something rather than nothing — silence costs the permission. */
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Ahd";
  const options = {
    body: data.body || "",
    icon: "/brand/mark-192.png",
    badge: "/brand/mark-64.png",
    /* Same tag replaces rather than stacks: three unread morning reminders is
       three ways of saying the same thing. */
    tag: data.tag || "ahd",
    renotify: false,
    data: { url: data.url || "/app" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      /* Focus a window that is already open rather than opening a second copy
         of the app beside it. */
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
