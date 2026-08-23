import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: ".env.local", quiet: true });
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  console.log("plan_days:", await sql`select date, sabaq_from_line, sabaq_to_line,
    sabaq_done is not null as sabaq_done, sabqi_pages, manzil_pages, status
    from plan_days order by date desc limit 3`);
  console.log("plans:", await sql`select completed_lines, total_lines from plans where status='active' order by created_at desc limit 1`);
  console.log("units:", await sql`select page, strength from memorization_units order by page limit 5`);
  console.log("streak:", await sql`select current_streak, longest_streak, last_complete_date from profiles order by created_at desc limit 1`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
