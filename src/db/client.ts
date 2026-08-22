import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { env } from "@/lib/env";
import * as schema from "./schema";

/* Neon's WebSocket driver rather than the HTTP one, because Ahd genuinely needs
   interactive transactions: creating a covenant writes the plan, its first
   amendment and its generated days together, and a half-written covenant would
   be worse than none. Node 22+ has a global WebSocket; older runtimes need the
   `ws` polyfill. */
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

/* Next reloads modules on every edit in development, so the pool is cached on
   globalThis to stop each save from opening a new one. */
const globalForDb = globalThis as unknown as { __ahdPool?: Pool };

const pool =
  globalForDb.__ahdPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    /* Serverless functions are short-lived and Neon's pooler does the real
       pooling, so keep very few connections per instance. */
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

if (env.NODE_ENV !== "production") globalForDb.__ahdPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Db = typeof db;
export { schema };
