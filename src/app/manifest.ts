import type { MetadataRoute } from "next";

/**
 * What Ahd becomes once it is installed.
 *
 * Served from the root rather than under a locale, because a manifest is one
 * per origin and the operating system reads it long before it knows which
 * language anyone speaks. The name is the brand, which is the same word in all
 * three; `start_url` is the bare path, so an installed icon opens in Uzbek by
 * default exactly as the website does.
 *
 * `display: standalone` is the point of the exercise: opened from the home
 * screen there is no address bar, which is most of what makes an installed
 * page feel like an application rather than a bookmark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ahd — Qur'on bilan ahdingiz",
    short_name: "Ahd",
    description:
      "Hifzingizni rejalashtiring, unga sodiq qoling, mashq qiling va hech qachon yoʻqotmang.",
    /* The dashboard, not the landing page. Somebody who has put Ahd on their
       home screen has already been sold; opening them onto the marketing copy
       every morning and asking them to find the way in is a tax on the most
       committed users. A lapsed session is bounced to sign-in from here by the
       same guard as everywhere else, so nothing is exposed. */
    start_url: "/app",
    /* Anything under the origin, so an installed window can reach the reader
       and the app without falling out into a browser tab. */
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    /* Emerald, not ink. The operating system paints this behind the icon while
       the app starts, and a near-black splash is indistinguishable from a phone
       that has not woken up — which is exactly what it looked like. This is the
       deepest green in the palette that is still plainly a green, it matches
       the launcher tile so the two are one surface, and `theme_color` is given
       the same value so the status bar does not stripe across the top of it. */
    background_color: "#0b483a",
    theme_color: "#0b483a",
    categories: ["education", "books", "lifestyle"],
    lang: "uz",
    dir: "ltr",
    icons: [
      { src: "/brand/mark-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/mark-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /* Separate entries, not `purpose: "any maskable"` on one file. A launcher
         crops a maskable icon to its own shape and takes anything outside the
         middle 80% with it, so these carry the padding a plain icon must not. */
      { src: "/brand/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Bugun", short_name: "Bugun", url: "/app" },
      { name: "Mashq", short_name: "Mashq", url: "/app/practice" },
      { name: "Qurʼon", short_name: "Qurʼon", url: "/quran" },
    ],
  };
}
