/**
 * Drives a real practice session against a running server, then reads the
 * database to see what actually happened.
 *
 * A server action that returns without throwing has proved nothing. Twice
 * already a mark that looked successful wrote nothing at all — once because the
 * action being posted to was the wrong one entirely. So this posts the real
 * action to a real server with a real session cookie, and then checks the rows.
 *
 *   npm run build && npm run start        # in another terminal
 *   npm run verify:practice:live
 */
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@practice.ahd.test";
/** Page 2 — Al-Baqara 1–5, which supports every mode. */
const PAGE = 2;

const sql = neon(process.env.DATABASE_URL!);

/**
 * The action's id, found by the file it lives in.
 *
 * Never by matching a path fragment against the manifest keys: doing that once
 * matched `logoutAction`, which every signed-in page imports, and three
 * "successful" marks wrote nothing.
 */
async function actionId(fileFragment: string, exportName: string): Promise<string> {
  const manifestPath = path.join(process.cwd(), ".next/server/server-reference-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const found = Object.entries(manifest.node as Record<string, { filename?: string }>).find(
    ([, value]) => (value.filename ?? "").replace(/\\/g, "/").includes(fileFragment),
  );

  if (!found) {
    throw new Error(
      `No server action found in a file matching "${fileFragment}". ` +
        `Searched ${Object.keys(manifest.node).length} entries. Is the build current?`,
    );
  }

  console.log(`  action ${exportName} → ${found[0].slice(0, 12)}… in ${fileFragment}`);
  return found[0];
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("never against production");

  /* ── an account that holds page 2 ── */
  const email = `practice-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'not-a-real-hash', 'Practice')
    returning id
  `) as { id: string }[];

  await sql`insert into profiles (user_id, locale, onboarded_at) values (${user.id}, 'uz', now())`;

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;

  /* Deliberately weak and long unreviewed, so a good session must move it. */
  await sql`
    insert into memorization_units
      (user_id, page, state, strength, ease, reps, lapses, interval_days,
       first_memorized_at, last_reviewed_at)
    values (${user.id}, ${PAGE}, 'memorized', 40, 2.5, 3, 0, 10,
            now() - interval '90 days', now() - interval '20 days')
  `;

  console.log(`account ${email}`);
  console.log(`page ${PAGE} held at strength 40, last recited 20 days ago\n`);

  /* ── the page renders ── */
  const cookie = `ahd_session=${token}`;
  const page = await fetch(`${BASE}/app/practice/${PAGE}?mode=gap`, {
    headers: { cookie },
    redirect: "manual",
  });

  console.log(`GET /app/practice/${PAGE}?mode=gap → ${page.status}`);
  if (page.status !== 200) {
    throw new Error(`the practice page did not render (${page.status})`);
  }

  const html = await page.text();
  for (const [what, present] of [
    ["the ayah in Arabic", html.includes('dir="rtl"')],
    ["a word bank to tap from", html.includes("bankHelp") || html.includes("Tanlang")],
    ["the mode navigation", html.includes("Mutashabihot") || html.includes("Boʻshliq")],
  ] as const) {
    console.log(`  ${present ? "✓" : "✗"} ${what}`);
    if (!present) throw new Error(`page rendered without ${what}`);
  }

  /* ── answer it, correctly, through the real action ── */
  const { rebuildDrill } = await import("../src/app/[locale]/app/practice/session");
  const drill = await rebuildDrill({
    userId: user.id,
    page: PAGE,
    mode: "gap",
    level: 0,
    nonce: "",
  });
  if (!drill) throw new Error("could not rebuild the drill");

  const answers = drill.questions.map((question) => {
    if (question.kind !== "assemble") return null;
    const spent = new Set<string>();
    return {
      kind: "assemble",
      placed: question.blanks.map((wordIndex) => {
        const wanted = question.words[wordIndex].text;
        const word = question.bank.find((w) => w.text === wanted && !spent.has(w.id));
        if (word) spent.add(word.id);
        return word?.id ?? null;
      }),
    };
  });

  const id = await actionId("app/practice/actions", "submitDrill");

  const form = new FormData();
  form.set("page", String(PAGE));
  form.set("mode", "gap");
  form.set("level", "0");
  form.set("nonce", "");
  form.set("durationSec", "120");
  form.set("answers", JSON.stringify(answers));

  /* The action is bound through useActionState, so it receives two arguments:
     the previous state and the form data. Posting the bare form fields is what
     a plain HTTP client would do, and the server rejects it with
     INSUFFICIENT_PATH — the body has to be React's own encoding, which is what
     the browser sends. */
  const { encodeReply } = await import(
    "next/dist/compiled/react-server-dom-turbopack/client.node.js"
  );
  const body = await encodeReply([{ status: "idle" }, form]);

  const posted = await fetch(`${BASE}/app/practice/${PAGE}?mode=gap`, {
    method: "POST",
    headers: {
      cookie,
      "next-action": id,
      ...(typeof body === "string" ? { "content-type": "text/plain;charset=UTF-8" } : {}),
    },
    body,
    redirect: "manual",
  });

  console.log(`\nPOST submitDrill → ${posted.status}`);
  await posted.text();

  /* ── what the database says, which is the only thing that counts ── */
  const [unit] = (await sql`
    select strength, ease, reps, lapses, interval_days, next_due_at,
           last_reviewed_at > now() - interval '2 minutes' as just_reviewed
    from memorization_units where user_id = ${user.id} and page = ${PAGE}
  `) as Record<string, unknown>[];

  const logs = (await sql`
    select type, quality, mistake_count, duration_sec, strength_before, strength_after
    from review_logs where user_id = ${user.id}
  `) as Record<string, unknown>[];

  const wrong = (await sql`
    select count(*)::int as n from mistakes where user_id = ${user.id}
  `) as { n: number }[];

  console.log("\nunit    ", JSON.stringify(unit));
  console.log("logs    ", JSON.stringify(logs));
  console.log("mistakes", wrong[0].n);

  const checks: [string, boolean][] = [
    ["exactly one review was logged", logs.length === 1],
    ["it was logged as a test", logs[0]?.type === "test"],
    ["a perfect drill scored 5", logs[0]?.quality === 5],
    ["no mistakes were recorded", wrong[0].n === 0],
    ["the duration was kept", logs[0]?.duration_sec === 120],
    [
      "strength was judged after decay, not from the stored 40",
      typeof logs[0]?.strength_before === "number" && (logs[0].strength_before as number) < 40,
    ],
    ["strength rose", (unit?.strength as number) > (logs[0]?.strength_before as number)],
    ["the page was marked recited", unit?.just_reviewed === true],
    ["a next due date was set", unit?.next_due_at !== null],
    ["the interval grew past the stored 10 days", (unit?.interval_days as number) > 10],
    ["reps advanced", (unit?.reps as number) === 4],
    ["no lapse was recorded", (unit?.lapses as number) === 0],
  ];

  console.log("");
  let failed = 0;
  for (const [what, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${what}`);
    if (!ok) failed++;
  }

  /* ── the same drill, answered wrongly ── */
  console.log("\n─── now the same page, answered wrongly ───");

  const wrongAnswers = drill.questions.map((question) => {
    if (question.kind !== "assemble") return null;
    /* Place a decoy in every slot: the bank always carries some. */
    return {
      kind: "assemble",
      placed: question.blanks.map((wordIndex) => {
        const wanted = question.words[wordIndex].text;
        return question.bank.find((w) => w.text !== wanted)?.id ?? null;
      }),
    };
  });

  const badForm = new FormData();
  badForm.set("page", String(PAGE));
  badForm.set("mode", "gap");
  badForm.set("level", "0");
  badForm.set("nonce", "");
  badForm.set("durationSec", "40");
  badForm.set("answers", JSON.stringify(wrongAnswers));

  const badBody = await encodeReply([{ status: "idle" }, badForm]);
  const badPost = await fetch(`${BASE}/app/practice/${PAGE}?mode=gap`, {
    method: "POST",
    headers: {
      cookie,
      "next-action": id,
      ...(typeof badBody === "string" ? { "content-type": "text/plain;charset=UTF-8" } : {}),
    },
    body: badBody,
    redirect: "manual",
  });
  await badPost.text();
  console.log(`POST submitDrill (all wrong) → ${badPost.status}`);

  const [after] = (await sql`
    select strength, lapses, interval_days from memorization_units
    where user_id = ${user.id} and page = ${PAGE}
  `) as Record<string, unknown>[];

  const badLog = (await sql`
    select quality, mistake_count from review_logs
    where user_id = ${user.id} order by created_at desc limit 1
  `) as Record<string, unknown>[];

  const recorded = (await sql`
    select kind, surah, ayah, word_index from mistakes
    where user_id = ${user.id} order by created_at
  `) as Record<string, unknown>[];

  console.log("unit    ", JSON.stringify(after));
  console.log("last log", JSON.stringify(badLog[0]));
  console.log(`mistakes ${recorded.length}:`, JSON.stringify(recorded.slice(0, 3)));

  const badChecks: [string, boolean][] = [
    ["a wholly wrong drill scored 0", badLog[0]?.quality === 0],
    ["every blank was counted as a mistake", (badLog[0]?.mistake_count as number) > 0],
    ["one mistake row per missed word", recorded.length === (badLog[0]?.mistake_count as number)],
    ["the mistakes name a word, not just a page", recorded.every((m) => m.word_index !== null)],
    ["the mistakes name the ayah", recorded.every((m) => (m.surah as number) > 0)],
    ["a lapse was recorded", (after?.lapses as number) === 1],
    ["strength fell", (after?.strength as number) < 53],
    ["the page comes back tomorrow", (after?.interval_days as number) === 1],
  ];

  console.log("");
  for (const [what, ok] of badChecks) {
    console.log(`  ${ok ? "✓" : "✗"} ${what}`);
    if (!ok) failed++;
  }

  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (failed > 0) {
    console.error(`\n✗ ${failed} checks failed`);
    process.exit(1);
  }
  console.log("✓ the session was recorded exactly as it should have been");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
