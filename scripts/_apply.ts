import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: ".env.local", quiet: true });
async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!);
  const file = process.argv[2];
  const statements = readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    try {
      await sql.query(stmt);
      console.log("  ok  ", stmt.split("\n")[0].slice(0, 72));
    } catch (e) {
      console.log("  SKIP", stmt.split("\n")[0].slice(0, 60), "→", (e as Error).message.slice(0, 70));
    }
  }
}
main();
