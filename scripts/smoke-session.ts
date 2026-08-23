/**
 * Mints a throwaway, fully-onboarded account and prints its session cookie, so
 * signed-in pages can be walked with curl.
 *
 * Every earlier crash — the t.rich one, then E352 — reached a real person
 * because verification stopped at pages that only ever redirect. This makes the
 * signed-in half of the app as easy to check as the public half.
 *
 *   npx tsx scripts/smoke-session.ts            # create and print
 *   npx tsx scripts/smoke-session.ts --clean    # remove every smoke account
 */
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const SMOKE_DOMAIN = "@smoke.ahd.test";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("never in production");
  const sql = neon(process.env.DATABASE_URL!);

  if (process.argv.includes("--clean")) {
    const gone = await sql`delete from users where email like ${"%" + SMOKE_DOMAIN} returning id`;
    console.log(`removed ${gone.length} smoke accounts`);
    return;
  }

  const email = `smoke-${Date.now()}${SMOKE_DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'not-a-real-hash', 'Smoke')
    returning id
  `) as { id: string }[];

  await sql`
    insert into profiles (user_id, locale, onboarded_at)
    values (${user.id}, 'uz', now())
  `;

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;

  console.log(`email=${email}`);
  console.log(`userId=${user.id}`);
  console.log(`cookie=ahd_session=${token}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
