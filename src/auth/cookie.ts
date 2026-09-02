/**
 * The session cookie's name, and nothing else.
 *
 * Split out of ./session so the proxy can import it. That module is
 * `server-only` and pulls in the database driver; the proxy runs on the edge
 * and must not carry either.
 */
export const SESSION_COOKIE = "ahd_session";
