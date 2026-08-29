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

  /* ── Everyone who is not an admin must be turned away ──
     A signed-in stranger gets 404: a redirect to /app would tell them the page
     exists and is not theirs. Someone signed out goes to /login, because they
     may be the admin with an expired session and every protected route in the
     product answers that way. */
  for (const [who, account, expected] of [
    ["signed out", anonymous, "redirect"],
    ["an ordinary reader", reader, "notFound"],
    ["a teacher", teacher, "notFound"],
  ] as const) {
    for (const path of PATHS) {
      const { status, location, body } = await visit(path, account.token);
      const redirected = status >= 300 && status < 400;

      console.log(
        `  ${who.padEnd(20)} ${path.padEnd(14)} → ${status}${location ? ` → ${location}` : ""}`,
      );

      if (expected === "redirect" && !redirected) {
        failures.push(`${who} got ${status} on ${path} instead of a redirect to /login`);
      }
      if (expected === "notFound" && status !== 404) {
        failures.push(`${who} got ${status} on ${path} instead of 404`);
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

  /* ── And the way in must be shown to nobody else ── */
  const readerApp = await visit("/app", reader.token);
  if (readerApp.body.includes('href="/admin"')) {
    failures.push("an ordinary reader is shown a link to /admin");
  } else {
    console.log("\n  ✓ no admin link for an ordinary reader");
  }

  const adminApp = await visit("/app", admin.token);
  if (!adminApp.body.includes('href="/admin"')) {
    failures.push("an admin is not shown a link to /admin");
  } else {
    console.log("  ✓ the admin is shown the way in");
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
