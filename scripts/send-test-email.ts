/**
 * Sends a real verification email through whatever transport the environment
 * selects. Renders the actual template, so this proves the whole path — SMTP
 * auth, TLS negotiation, the HTML, the code formatting — not just connectivity.
 *
 *   npx tsx scripts/send-test-email.ts you@example.com [uz|en|ru]
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const to = process.argv[2];
  const locale = (process.argv[3] ?? "uz") as "uz" | "en" | "ru";
  if (!to) throw new Error("usage: tsx scripts/send-test-email.ts <address> [locale]");

  const { activeTransport, sendMail } = await import("../src/email/mailer");
  const { verificationEmail } = await import("../src/email/templates");
  const { generateOtp } = await import("../src/auth/codes");

  const code = generateOtp();
  console.log(`transport : ${activeTransport()}`);
  console.log(`from      : ${process.env.EMAIL_FROM}`);
  console.log(`to        : ${to}`);
  console.log(`locale    : ${locale}`);
  console.log(`code      : ${code}\n`);

  const started = Date.now();
  const result = await sendMail(await verificationEmail(locale, to, code));
  console.log(`\nsent=${result.sent} via=${result.via} in ${Date.now() - started}ms`);
  if (!result.sent) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
