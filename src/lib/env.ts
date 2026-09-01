import { z } from "zod";

/**
 * Environment, validated once at module load.
 *
 * A missing DATABASE_URL should fail the build loudly, not surface as a
 * mysterious runtime error on someone's first sign-up attempt.
 */
const schema = z.object({
  DATABASE_URL: z.url().startsWith("postgres"),
  DATABASE_URL_UNPOOLED: z.url().startsWith("postgres").optional(),

  // Signs session tokens and the HMACs stored for verification links.
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  /* ── Email ──────────────────────────────────────────────────────────────
     Three transports, chosen in this order: SMTP if a host is configured,
     otherwise Resend if there is an API key, otherwise the console. Development
     therefore works with no mail provider at all — the code is printed to the
     terminal — and adding SMTP later is purely an environment change. */
  /* Vercel sends this as a bearer token on every scheduled call. Unset means
     the cron route refuses everything rather than standing open — it can mail
     every address in the database. */
  CRON_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Ahd <onboarding@resend.dev>"),
  EMAIL_REPLY_TO: z.string().optional(),

  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function load() {
  /* An unset variable in a .env file is usually written as SMTP_HOST="" rather
     than left out, so an empty string has to mean "not configured" — otherwise
     every optional field arrives as "" and defaults never apply. */
  const source = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ""),
  );

  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment. Copy .env.example to .env.local and fill it in.\n${issues}`,
    );
  }
  return parsed.data;
}

export const env = load();

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
