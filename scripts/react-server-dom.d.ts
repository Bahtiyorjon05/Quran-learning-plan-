/**
 * Next bundles its own copy of the RSC client and ships no types for it.
 *
 * `verify-practice-live.ts` needs `encodeReply` to post a server action the way
 * a browser does — plain form fields are rejected with INSUFFICIENT_PATH. This
 * is an internal build artefact, so the declaration lives here beside the
 * script rather than pretending to be a public API.
 */
declare module "next/dist/compiled/react-server-dom-turbopack/client.node.js" {
  export function encodeReply(value: unknown): Promise<string | FormData>;
}
