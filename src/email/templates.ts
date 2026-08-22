import "server-only";

import { createTranslator } from "next-intl";

import { formatOtp, OTP_TTL_MINUTES } from "@/auth/constants";
import type { Locale } from "@/i18n/routing";
import type { Mail } from "./mailer";

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
type EmailNamespace = "email.common" | "email.verify" | "email.reset";

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
              <td style="background:${INK};padding:26px 32px;">
                <span style="color:#ffffff;font-size:19px;font-weight:600;letter-spacing:0.02em;">Ahd</span>
                <span style="color:${GOLD};font-size:15px;padding-left:8px;">&#1593;&#1607;&#1583;</span>
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
