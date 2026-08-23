import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const plans = await sql`
    select scope, scope_from_page, scope_to_page, total_lines, start_date,
           original_end_date, current_end_date, study_days_mask, rukhsah_budget,
           status, left(niyyah, 44) as niyyah
    from plans order by created_at desc limit 3`;
  console.log("plans:");
  for (const p of plans) console.log(" ", p);

  const amendments = await sql`
    select kind, old_end_date, new_end_date, old_total_lines, new_total_lines, reason
    from plan_amendments order by created_at desc limit 5`;
  console.log("\namendments (written by the trigger, never by app code):");
  for (const a of amendments) console.log(" ", a);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
