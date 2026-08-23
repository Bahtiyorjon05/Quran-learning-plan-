import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    select u.email, p.preferred_reciter, p.study_time, p.time_zone,
           (p.onboarded_at is not null) as onboarded
    from profiles p join users u on u.id = p.user_id
    order by p.created_at desc limit 3`;
  for (const r of rows) console.log(r);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
