ALTER TABLE "memorization_units" ALTER COLUMN "ease" SET DATA TYPE numeric(3, 2);--> statement-breakpoint
ALTER TABLE "memorization_units" ALTER COLUMN "ease" SET DEFAULT 2.5;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "weekly_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "memorization_units" ADD COLUMN IF NOT EXISTS "surahs" smallint[];