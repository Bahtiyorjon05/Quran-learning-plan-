import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const triggers = await sql`
    select c.relname as table_name, t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal
    order by c.relname, t.tgname
  `;

  const checks = await sql`
    select count(*)::int as n from pg_constraint
    where contype = 'c' and connamespace = 'public'::regnamespace
  `;

  const tables = await sql`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public'
  `;

  const counts = await sql`
    select
      (select count(*) from users)::int           as users,
      (select count(*) from plans)::int           as plans,
      (select count(*) from plan_amendments)::int as amendments,
      (select count(*) from sessions)::int        as sessions
  `;

  console.log(`\ntables: ${tables[0].n}   check constraints: ${checks[0].n}`);
  console.log(`\ntriggers (${triggers.length}):`);
  for (const t of triggers) {
    console.log(`  ${String(t.table_name).padEnd(22)} ${t.trigger_name}`);
  }
  console.log(`\nrow counts:`, counts[0]);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
