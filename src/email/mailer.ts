import "server-only";

import { env, isProd } from "@/lib/env";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type TransportName = "smtp" | "resend" | "console";

/**
 * Which transport is in use is decided once, from the environment:
 *
 *   SMTP_HOST set        → SMTP        (your provider, once you have one)
 *   RESEND_API_KEY set   → Resend
 *   neither              → console     (development)
 *
 * Adding SMTP later changes no application code at all, which is the point.
 */
export function activeTransport(): TransportName {
  if (env.SMTP_HOST) return "smtp";
  if (env.RESEND_API_KEY) return "resend";
  return "console";
}

/* ── SMTP ─────────────────────────────────────────────────────────────────── */

let smtpTransporter: import("nodemailer").Transporter | null = null;

async function sendViaSmtp(mail: Mail) {
  if (!smtpTransporter) {
    const nodemailer = await import("nodemailer");
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
      /* Serverless functions are short-lived; a pool would be torn down before
         it paid for itself. */
      pool: false,
    } as import("nodemailer/lib/smtp-transport").Options);
  }

  await smtpTransporter.sendMail({
    from: env.EMAIL_FROM,
    replyTo: env.EMAIL_REPLY_TO,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

/* ── Resend ───────────────────────────────────────────────────────────────── */

async function sendViaResend(mail: Mail) {
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    replyTo: env.EMAIL_REPLY_TO,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  if (error) throw new Error(`Resend refused the message: ${error.message}`);
}

/* ── Console ──────────────────────────────────────────────────────────────── */

function sendViaConsole(mail: Mail) {
  const line = "─".repeat(64);
  console.log(
    [
      "",
      line,
      `  ✉  ${mail.subject}`,
      `     to: ${mail.to}`,
      line,
      mail.text
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
      line,
      "",
    ].join("\n"),
  );
}

/* ── Send ─────────────────────────────────────────────────────────────────── */

/**
 * Delivery failures are logged, never thrown.
 *
 * If the mail provider is down, a new user has still been created and can use
 * "resend code" a minute later. Failing the whole sign-up because an SMTP
 * server hiccuped would be a worse outcome than a delayed code.
 */
/**
 * Addresses that can never receive mail, and must never be posted to.
 *
 * RFC 2606 and RFC 6761 set these aside precisely so nothing tries to deliver
 * to them, and the verification scripts use `.test` for exactly that reason.
 * Handing one to a real SMTP server does not fail quietly: the server accepts
 * the message, fails to resolve the domain, and mails a bounce back to the
 * sending account — so every run of the sign-up check dropped a "message not
 * delivered" into the inbox Ahd sends from.
 *
 * Refused here rather than in the tests, because it is true of the product:
 * posting to a reserved domain is guaranteed to bounce whoever asks for it.
 */
const UNDELIVERABLE = /\.(test|invalid|example|localhost)$/i;

function isUndeliverable(address: string): boolean {
  const domain = address.split("@").pop() ?? "";
  return UNDELIVERABLE.test(domain.trim().toLowerCase());
}

export async function sendMail(mail: Mail): Promise<{ sent: boolean; via: TransportName }> {
  const via = activeTransport();

  if (isUndeliverable(mail.to)) {
    /* Written to the console so a test can still read the code out of it, and
       reported as sent because from the caller's side nothing went wrong. */
    console.log(`[email] ${mail.to} is a reserved domain — not delivering.`);
    sendViaConsole(mail);
    return { sent: true, via: "console" };
  }

  try {
    if (via === "smtp") await sendViaSmtp(mail);
    else if (via === "resend") await sendViaResend(mail);
    else sendViaConsole(mail);

    return { sent: true, via };
  } catch (error) {
    console.error(`[email] ${via} delivery failed for "${mail.subject}":`, error);

    /* In development, still show the code so work is never blocked by mail. */
    if (!isProd && via !== "console") sendViaConsole(mail);

    return { sent: false, via };
  }
}
