/**
 * Gives an account some pages to revise, so the practice screens have content.
 *
 * A fresh account holds nothing, which means the practice list, the strength
 * bars and the manzil rotation all render their empty states and cannot be
 * looked at. This fills in a spread deliberately chosen to exercise the
 * ordering: one strong page seen yesterday, one weak page not seen in weeks.
 *
 *   npx tsx scripts/seed-hifz.ts <userId>
 *   npx tsx scripts/seed-hifz.ts <userId> --clear
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

/** page, strength, days since it was last recited. */
const SPREAD: [number, number, number][] = [
  [2, 45, 9],
  [3, 20, 40],
  [4, 65, 3],
  [528, 80, 2],
  [604, 60, 15],
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("never in production");

  const user = process.argv[2];
  if (!user) throw new Error("usage: seed-hifz.ts <userId> [--clear]");

  const sql = neon(process.env.DATABASE_URL!);

  if (process.argv.includes("--clear")) {
    const gone = await sql`delete from memorization_units where user_id = ${user} returning page`;
    console.log(`cleared ${gone.length} pages`);
    return;
  }

  for (const [page, strength, days] of SPREAD) {
    await sql`
      insert into memorization_units
        (user_id, page, state, strength, reps, interval_days, first_memorized_at, last_reviewed_at)
      values (${user}, ${page}, 'memorized', ${strength}, 2, 6,
              now() - interval '60 days', now() - make_interval(days => ${days}))
      on conflict (user_id, page) do update
        set strength = ${strength},
            last_reviewed_at = now() - make_interval(days => ${days})
    `;
  }

  const held = (await sql`
    select page, strength from memorization_units where user_id = ${user} order by page
  `) as { page: number; strength: number }[];

  console.log(`held: ${held.map((h) => `${h.page} (${h.strength})`).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
