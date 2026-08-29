/**
 * Makes an account an admin, or takes it back.
 *
 * Deliberately a command-line job with no screen behind it. A "promote to
 * admin" button in the product is a button that can be reached by anyone who
 * gets hold of one admin session, and the whole point of the role is that it
 * cannot be handed out by accident.
 *
 *   npx tsx scripts/grant-admin.ts you@example.com
 *   npx tsx scripts/grant-admin.ts you@example.com --revoke
 *   npx tsx scripts/grant-admin.ts --list
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

  if (args.includes("--list") || !email) {
    const admins = (await sql`
      select email, email_verified_at is not null as verified
      from users where role = 'admin' order by email
    `) as { email: string; verified: boolean }[];

    if (admins.length === 0) {
      console.log("No admins. Grant one with:");
      console.log("  npx tsx scripts/grant-admin.ts you@example.com");
      return;
    }
    console.log(`${admins.length} admin${admins.length === 1 ? "" : "s"}:`);
    for (const a of admins) console.log(`  ${a.email}${a.verified ? "" : "  (unverified)"}`);
    return;
  }

  const [found] = (await sql`
    select id, role, email_verified_at is not null as verified
    from users where lower(email) = ${email}
  `) as { id: string; role: string; verified: boolean }[];

  if (!found) {
    console.error(`No account for ${email}.`);
    process.exit(1);
  }

  /* An unverified address is not proof of anything, and the admin pages show
     every account's data. */
  if (!revoke && !found.verified) {
    console.error(`${email} has not verified their address. Not granting admin.`);
    process.exit(1);
  }

  const next = revoke ? "user" : "admin";
  if (found.role === next) {
    console.log(`${email} is already ${next}.`);
    return;
  }

  await sql`update users set role = ${next}, updated_at = now() where id = ${found.id}`;

  /* Recorded in the same log as sign-ins, so a change of privilege is never
     invisible after the fact. */
  await sql`
    insert into auth_events (user_id, email, kind, detail)
    values (${found.id}, ${email}, 'password_changed', ${`role ${found.role} → ${next}`})
  `;

  console.log(`${email}: ${found.role} → ${next}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
