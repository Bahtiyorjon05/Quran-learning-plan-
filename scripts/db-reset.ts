/**
 * Drops and recreates the public schema. Development only — it refuses to run
 * against anything that is not obviously a development database.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:reset must never run in production");
  }
  const sql = neon(process.env.DATABASE_URL!);

  const [{ n }] = (await sql`select count(*)::int as n from information_schema.tables
    where table_schema = 'public'`) as { n: number }[];
  console.log(`dropping public schema (${n} tables) and the drizzle journal…`);

  await sql`drop schema if exists public cascade`;
  await sql`create schema public`;
  await sql`drop schema if exists drizzle cascade`;

  console.log("done — run `npm run db:migrate` to rebuild");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
