/**
 * Checks that the admin screens are shut to everyone who is not an admin.
 *
 * This is the one part of Ahd where a mistake exposes other people's addresses
 * and progress, so it is verified against a running server rather than trusted
 * to a guard call being present in the source.
 *
 *   npm run verify:admin
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@admincheck.ahd.test";
const PATHS = ["/admin", "/admin/users"];

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/** A signed-in, fully onboarded account with the given role. */
async function makeAccount(role: "user" | "teacher" | "admin") {
  const email = `${role}-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name, role)
    values (${email}, now(), 'not-a-real-hash', ${role}, ${role})
    returning id
  `) as { id: string }[];

  await sql`insert into profiles (user_id, locale, onboarded_at) values (${user.id}, 'uz', now())`;

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;
  return { token, email };
}

async function visit(path: string, token: string | null) {
  const response = await fetch(`${BASE}${path}`, {
    headers: token ? { cookie: `ahd_session=${token}` } : {},
    redirect: "manual",
  });
  const body = response.status === 200 ? await response.text() : "";
  return { status: response.status, location: response.headers.get("location"), body };
}

async function main() {
  console.log(`${BASE}\n`);

  const anonymous = { token: null as string | null, email: "(signed out)" };
  const reader = await makeAccount("user");
  const teacher = await makeAccount("teacher");
  const admin = await makeAccount("admin");

  /* ── Everyone who is not an admin must be turned away ── */
  for (const [who, account] of [
    ["signed out", anonymous],
    ["an ordinary reader", reader],
    ["a teacher", teacher],
  ] as const) {
    for (const path of PATHS) {
      const { status, location, body } = await visit(path, account.token);
      const turnedAway = status >= 300 && status < 400;

      console.log(`  ${who.padEnd(20)} ${path.padEnd(14)} → ${status}${location ? ` → ${location}` : ""}`);

      if (!turnedAway) {
        failures.push(`${who} got ${status} on ${path} instead of a redirect`);
      }
      /* Belt and braces: even a wrong status must not have leaked the page. */
      if (body.includes("Where people stop") || body.includes("everyone&rsquo;s data")) {
        failures.push(`${who} was served admin content on ${path}`);
      }
    }
  }

  /* ── And an admin must actually get in ── */
  console.log("");
  for (const path of PATHS) {
    const { status, body } = await visit(path, admin.token);
    console.log(`  ${"an admin".padEnd(20)} ${path.padEnd(14)} → ${status}`);

    if (status !== 200) failures.push(`an admin got ${status} on ${path}`);
    else if (!body.includes("Admin")) failures.push(`${path} rendered without the admin band`);
  }

  /* ── The pages must never be indexed ── */
  const { body } = await visit("/admin", admin.token);
  if (!/noindex/i.test(body)) failures.push("/admin does not send noindex");
  else console.log("\n  ✓ noindex present");

  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("test accounts removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} failures:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ the admin screens are shut to everyone but admins");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
