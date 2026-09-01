import "server-only";

import { createTranslator } from "next-intl";

import { formatOtp, OTP_TTL_MINUTES } from "@/auth/constants";
import type { Locale } from "@/i18n/routing";
import type { Mail } from "./mailer";
import { env } from "@/lib/env";

import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import uz from "../../messages/uz.json";

const MESSAGES = { en, ru, uz } as const;

/**
 * Messages are loaded directly rather than through `getTranslations`, which
 * needs an active request scope. Email is not always sent inside one — the
 * weekly report cards and reminder digests in later phases run from a cron job
 * with no request at all — so the templates must not depend on it.
 */
type EmailNamespace = "email.common" | "email.verify" | "email.reset" | "email.weekly";

function translator(locale: Locale, namespace: EmailNamespace) {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace });
}

/**
 * Email HTML, not web HTML.
 *
 * Every style is inline, the layout is a single centred table, and there is no
 * external CSS, webfont or image — Outlook, Mail.ru and Gmail's clipper all
 * disagree about everything else. The code is rendered as large plain text so
 * it survives a client that strips styling entirely.
 */

const INK = "#0f1815";
const EMERALD = "#0e5c4a";
const GOLD = "#c9a227";
const PAPER = "#f7f1e3";
const MUTED = "#6b7a74";

/* Absolute, because an email is read outside our origin.
   The 256 rather than the 128: the seal is an intricate thing — a book, a
   crescent, two scripts — and at 48 points it needs the extra pixels or it
   renders as a grey smudge on the dark band. */
const LOGO = `${env.NEXT_PUBLIC_SITE_URL}/brand/mark-256.png`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell({
  preheader,
  heading,
  body,
  code,
  footnote,
  footer,
}: {
  preheader: string;
  heading: string;
  body: string;
  code?: string;
  footnote?: string;
  footer: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,24,21,0.08);">

            <tr>
              <td style="background:${INK};padding:22px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <!-- alt is empty on purpose. Most clients block remote
                         images until the reader allows them, and an alt of
                         "Ahd" rendered a broken-image glyph beside dark text
                         on a dark band. The wordmark is already right there in
                         white, so the seal is decoration and a blocked one
                         should leave nothing behind rather than a ruin. -->
                    <img src="${LOGO}" width="48" height="48" alt=""
                         style="display:block;width:48px;height:48px;border:0;color:#ffffff;background:${INK};" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:19px;font-weight:600;letter-spacing:0.02em;">Ahd</span>
                    <span style="color:${GOLD};font-size:15px;padding-left:8px;">&#1593;&#1607;&#1583;</span>
                  </td>
                </tr></table>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 32px 8px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;color:${INK};">${escapeHtml(heading)}</h1>
                <p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:${MUTED};">${escapeHtml(body)}</p>
              </td>
            </tr>

            ${
              code
                ? `<tr>
              <td style="padding:28px 32px 4px;" align="center">
                <div style="display:inline-block;background:${PAPER};border:1px solid #e3dac4;border-radius:12px;padding:18px 28px;">
                  <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.16em;color:${EMERALD};">${escapeHtml(formatOtp(code))}</span>
                </div>
              </td>
            </tr>`
                : ""
            }

            ${
              footnote
                ? `<tr>
              <td style="padding:20px 32px 0;" align="center">
                <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(footnote)}</p>
              </td>
            </tr>`
                : ""
            }

            <tr>
              <td style="padding:32px 32px 36px;">
                <div style="height:1px;background:#ece5d5;margin-bottom:20px;"></div>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#93a09a;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0;font-size:12px;color:#93a09a;">Ahd &middot; ${escapeHtml("عهد")}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function verificationEmail(
  locale: Locale,
  to: string,
  code: string,
): Promise<Mail> {
  const t = translator(locale, "email.verify");
  const tc = translator(locale, "email.common");

  const body = t("body");
  const footnote = t("expiry", { minutes: OTP_TTL_MINUTES });
  const footer = t("ignore");

  return {
    to,
    subject: t("subject", { code }),
    html: shell({
      preheader: t("preheader", { code }),
      heading: t("heading"),
      body,
      code,
      footnote,
      footer,
    }),
    text: [
      t("heading"),
      "",
      body,
      "",
      `    ${formatOtp(code)}`,
      "",
      footnote,
      "",
      footer,
      "",
      tc("signature"),
    ].join("\n"),
  };
}

export async function passwordResetEmail(
  locale: Locale,
  to: string,
  code: string,
): Promise<Mail> {
  const t = translator(locale, "email.reset");
  const tc = translator(locale, "email.common");

  const body = t("body");
  const footnote = t("expiry", { minutes: OTP_TTL_MINUTES });
  const footer = t("ignore");

  return {
    to,
    subject: t("subject"),
    html: shell({
      preheader: t("preheader"),
      heading: t("heading"),
      body,
      code,
      footnote,
      footer,
    }),
    text: [
      t("heading"),
      "",
      body,
      "",
      `    ${formatOtp(code)}`,
      "",
      footnote,
      "",
      footer,
      "",
      tc("signature"),
    ].join("\n"),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE WEEKLY REPORT
   The one message Ahd sends that nobody asked for, so it has to earn the
   interruption. It says what happened, what is slipping, and nothing else —
   no streaks-are-great, no come-back-we-miss-you.
   ═══════════════════════════════════════════════════════════════════════════ */

export type WeeklyFigures = {
  /** Pages committed to memory in the last seven days. */
  memorized: number;
  /** Drills marked in the last seven days. */
  drills: number;
  /** Days in a row with the day's work complete. */
  streak: number;
  /** Pages held whose strength has decayed below the fragile line. */
  fragile: number;
  /** Total pages held. */
  held: number;
  /** Days of slack against the covenant. Negative means behind. */
  daysBanked: number | null;
};

/**
 * A row of figures, as a table.
 *
 * Flexbox and grid do not survive Outlook, and a column that collapses turns a
 * report into a jumble. Two columns of a table always work.
 */
function figures(rows: { label: string; value: string; warn?: boolean }[]) {
  return rows
    .map(
      (row) => `<tr>
        <td style="padding:10px 0;font-size:14px;color:${MUTED};">${escapeHtml(row.label)}</td>
        <td align="right" style="padding:10px 0;font-size:18px;font-weight:600;color:${
          row.warn ? "#b45309" : INK
        };">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join("");
}

export async function weeklyReportEmail(
  locale: Locale,
  to: string,
  name: string,
  figures_: WeeklyFigures,
): Promise<Mail> {
  const t = translator(locale, "email.weekly");

  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";

  /* The one sentence that changes: what this week actually was. Nothing here
     congratulates a week that did not happen. */
  const verdict =
    figures_.memorized === 0 && figures_.drills === 0
      ? t("nothingThisWeek")
      : figures_.fragile > 0
        ? t("someSlipping", { count: figures_.fragile })
        : t("holding");

  const rows = [
    { label: t("newPages"), value: String(figures_.memorized) },
    { label: t("drills"), value: String(figures_.drills) },
    { label: t("held"), value: `${figures_.held} / 604` },
    {
      label: t("fragile"),
      value: String(figures_.fragile),
      warn: figures_.fragile > 0,
    },
    ...(figures_.streak > 0 ? [{ label: t("streak"), value: t("days", { count: figures_.streak }) }] : []),
    ...(figures_.daysBanked !== null
      ? [
          {
            label: figures_.daysBanked >= 0 ? t("banked") : t("owed"),
            value: t("days", { count: Math.abs(figures_.daysBanked) }),
            warn: figures_.daysBanked < 0,
          },
        ]
      : []),
  ];

  const html = shell({
    preheader: verdict,
    heading: first ? t("headingNamed", { name: first }) : t("heading"),
    body: verdict,
    footer: t("footer"),
  }).replace(
    /* The figures go between the body and the footer rule. Injected rather
       than added as another shell parameter, because this is the only message
       that has a table and the shell should stay the shape it is. */
    '<tr>\n              <td style="padding:32px 32px 36px;">',
    `<tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${figures(rows)}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0;" align="center">
                <a href="${env.NEXT_PUBLIC_SITE_URL}/app"
                   style="display:inline-block;background:${EMERALD};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:999px;">${escapeHtml(t("open"))}</a>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 32px 36px;">`,
  );

  const text = [
    first ? t("headingNamed", { name: first }) : t("heading"),
    "",
    verdict,
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    `${env.NEXT_PUBLIC_SITE_URL}/app`,
    "",
    t("footer"),
  ].join("\n");

  return { to, subject: t("subject"), html, text };
}

/** Exported so the cron can name the sender the same way the others do. */
export { MESSAGES as EMAIL_MESSAGES };
