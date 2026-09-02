"use client";

/**
 * Keeping a recitation on the device.
 *
 * The service worker already keeps whatever has been played, but only what has
 * been played, and only until the rolling cache evicts it. That is no use to
 * someone about to get on a train, or to the many people this is built for
 * whose data is metered and whose connection is not there when they want to
 * revise. So a juz or a surah can be asked for explicitly, once, and kept.
 *
 * The files go into a cache the service worker checks first and never trims,
 * and which survives a deploy — somebody who paid for a hundred megabytes on
 * mobile data should not lose them because a new version shipped.
 */

/** Shared with public/sw.js, which cannot import it. A test holds them together. */
export const SAVED_CACHE = "ahd-audio-saved";

/**
 * Where a download's own record lives.
 *
 * A Cache holds responses, not metadata, and counting the bytes of six hundred
 * stored files to draw one label would mean reading six hundred blobs. So each
 * download writes a small note about itself under a URL that is never
 * requested over the network — only read back out of the cache.
 */
function manifestUrl(key: string): string {
  return `https://ahd.invalid/saved/${encodeURIComponent(key)}`;
}

export type SavedInfo = { count: number; bytes: number };

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

/* ═══════════════════════════════════════════════════════════════════════════
   READING IT BACK, WITHOUT A CASCADING RENDER

   Whether a download exists is a fact about the browser, discovered
   asynchronously. The obvious `useEffect(() => { read().then(setState) })` is
   the cascading render React's lint rule rightly rejects, and it renders once
   with the wrong answer before correcting itself — which here means showing
   "Download" to somebody who already has it.

   `useSyncExternalStore` is the mechanism built for exactly this. The I/O
   happens in `subscribe`, which is allowed to have effects; `getSnapshot` is a
   pure read of a module-level map and returns a string, so React sees a stable
   value and does not loop.
   ═══════════════════════════════════════════════════════════════════════════ */

const known = new Map<string, SavedInfo | null>();
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/** The snapshot: "count|bytes", or "" for nothing kept. */
function encode(info: SavedInfo | null | undefined): string {
  return info ? `${info.count}|${info.bytes}` : "";
}

export function decodeSaved(snapshot: string): SavedInfo | null {
  if (!snapshot) return null;
  const [count, bytes] = snapshot.split("|").map(Number);
  return { count, bytes };
}

export function subscribeSaved(key: string) {
  return (onChange: () => void) => {
    listeners.add(onChange);

    /* Asked once per key, here rather than in a render or an effect body. */
    if (!known.has(key)) {
      void savedInfo(key).then((info) => {
        known.set(key, info);
        announce();
      });
    }

    return () => {
      listeners.delete(onChange);
    };
  };
}

export function savedSnapshot(key: string) {
  return () => encode(known.get(key));
}

/** Nothing is known on the server, and nothing can be. */
export const noSavedSnapshot = () => "";

/** Record what a download or a deletion just changed, and redraw. */
export function rememberSaved(key: string, info: SavedInfo | null) {
  known.set(key, info);
  announce();
}

/** What is already kept for this key, or null. */
export async function savedInfo(key: string): Promise<SavedInfo | null> {
  if (!offlineSupported()) return null;
  try {
    const cache = await caches.open(SAVED_CACHE);
    const note = await cache.match(manifestUrl(key));
    if (!note) return null;
    return (await note.json()) as SavedInfo;
  } catch {
    return null;
  }
}

/** Forget a download, and every file it brought. */
export async function forgetSaved(key: string, urls: string[]): Promise<void> {
  if (!offlineSupported()) return;
  const cache = await caches.open(SAVED_CACHE);
  await Promise.all(urls.map((url) => cache.delete(url)));
  await cache.delete(manifestUrl(key));
}

/** Bytes the origin is using, or null where the browser will not say. */
async function diskUsed(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return typeof estimate?.usage === "number" ? estimate.usage : null;
  } catch {
    return null;
  }
}

/**
 * Fetch every file and keep it, reporting progress as it goes.
 *
 * Six at a time: enough that a juz does not take all morning on a good
 * connection, few enough that it does not saturate a phone's one bar or look
 * to the CDN like something worth blocking. Files already kept are counted and
 * skipped, so a download interrupted halfway resumes rather than restarts.
 *
 * Fetched `no-cors`, which is not a shortcut but the only thing that works:
 * the recitation CDN sends no Access-Control-Allow-Origin, so an ordinary
 * fetch cannot read a single byte of it. An <audio> element can, because media
 * elements were never bound by CORS, and an opaque response cached under the
 * same URL is exactly what that element asks for later. The cost is that an
 * opaque body cannot be measured — hence the disk reading either side rather
 * than adding up response sizes.
 */
export async function saveForOffline(
  key: string,
  urls: string[],
  /* What to tell the reader they have. Not the number of files: a surah's
     download also carries the Basmala, and "4 ayahs" under Al-Kawthar, which
     has three, is a small lie on a page of the Qur'an. */
  ayahCount: number,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SavedInfo> {
  const cache = await caches.open(SAVED_CACHE);

  let done = 0;
  const total = urls.length;
  onProgress(0, total);

  const before = await diskUsed();

  const queue = [...urls];

  async function worker() {
    for (;;) {
      if (signal?.aborted) return;
      const url = queue.shift();
      if (!url) return;

      const already = await cache.match(url);
      if (!already) {
        const response = await fetch(url, { mode: "no-cors", signal });

        /* An opaque response reports status 0 and hides everything else, so
           "did it work" is the only question that can be asked of it. A 206 is
           a partial file and would play as a fragment; anything else that is
           not plainly OK is left for a later attempt rather than stored as a
           broken recitation. */
        const usable =
          response.type === "opaque" ? response.status === 0 : response.status === 200;
        if (!usable) {
          throw new Error(`${url} came back ${response.type} ${response.status}`);
        }

        await cache.put(url, response);
      }

      done += 1;
      onProgress(done, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, total) }, worker));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  /* Recorded but not shown. Browsers pad an opaque response's quota — Chrome
     charges about seven megabytes for a fifty-kilobyte ayah — so this number
     is the space reserved rather than the size of the recitation, and printing
     "4 GB" beside a juz would be alarming and false. The count of ayahs is
     what the label says, because that is a thing that is true. */
  const after = await diskUsed();
  const bytes = before !== null && after !== null ? Math.max(0, after - before) : 0;

  const info: SavedInfo = { count: ayahCount, bytes };
  await cache.put(
    manifestUrl(key),
    new Response(JSON.stringify(info), {
      headers: { "content-type": "application/json" },
    }),
  );
  return info;
}
