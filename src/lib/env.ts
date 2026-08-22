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

  // Email is optional in development: without a Resend key we log the
  // verification link to the console instead of sending it.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Ahd <onboarding@resend.dev>"),

  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function load() {
  const parsed = schema.safeParse(process.env);
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
