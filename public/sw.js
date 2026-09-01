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

const VERSION = "ahd-v1";
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const AUDIO = `${VERSION}-audio`;

/** Recitation is immutable but not unbounded; a full mushaf is a lot of mp3s. */
const AUDIO_LIMIT = 300;

self.addEventListener("install", (event) => {
  /* The offline page is the one thing worth having before it is needed. */
  event.waitUntil(
    caches.open(PAGES).then((cache) => cache.add("/offline")).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)),
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
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(PAGES);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cache = await caches.open(PAGES);
          /* This page if it has been seen, otherwise the one that explains
             what has happened. */
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
