import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const email = process.argv[2];

  const users = email
    ? await sql`select id, email, email_verified_at, (password_hash is not null) as has_password, created_at
                from users where email = ${email.toLowerCase()}`
    : await sql`select id, email, email_verified_at, (password_hash is not null) as has_password, created_at
                from users order by created_at desc limit 10`;
  console.log("users:", users);

  const events = await sql`select kind, email, detail, created_at from auth_events
                           order by created_at desc limit 15`;
  console.log("\nrecent auth events:");
  for (const e of events) console.log(`  ${e.created_at.toISOString()}  ${e.kind}  ${e.email ?? ""}  ${e.detail ?? ""}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
