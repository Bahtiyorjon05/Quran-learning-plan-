/** Removes rows left behind by integration tests. Development only. */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("never in production");
  const sql = neon(process.env.DATABASE_URL!);

  const users = await sql`delete from users where email like '%@ahd.test' returning id`;
  const events = await sql`delete from auth_events where email like '%@ahd.test' returning id`;

  console.log(`removed ${users.length} test users, ${events.length} test auth events`);

  const counts = await sql`
    select (select count(*) from users)::int as users,
           (select count(*) from sessions)::int as sessions,
           (select count(*) from auth_events)::int as auth_events,
           (select count(*) from plans)::int as plans`;
  console.log(counts[0]);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
