import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const units = await sql`
    select page, state, strength, first_memorized_at is not null as has_first
    from memorization_units order by page`;
  console.log("memorization units:", units);

  const plans = await sql`
    select total_lines, completed_lines,
           round(100.0 * completed_lines / total_lines, 2) as percent
    from plans where status = 'active'`;
  console.log("active plan progress:", plans);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
