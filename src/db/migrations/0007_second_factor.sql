DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'two_factor_purpose') THEN
    CREATE TYPE "public"."two_factor_purpose" AS ENUM('enable', 'reset');
  END IF;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."auth_event_kind" ADD VALUE IF NOT EXISTS 'two_factor_enabled';
--> statement-breakpoint
ALTER TYPE "public"."auth_event_kind" ADD VALUE IF NOT EXISTS 'two_factor_disabled';
--> statement-breakpoint
ALTER TYPE "public"."auth_event_kind" ADD VALUE IF NOT EXISTS 'two_factor_failed';
--> statement-breakpoint
ALTER TYPE "public"."auth_event_kind" ADD VALUE IF NOT EXISTS 'two_factor_reset';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "two_factor_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "two_factor_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "two_factor_codes_attempts_sane" CHECK ("two_factor_codes"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "two_factors" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "second_factor_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'two_factor_codes_user_id_users_id_fk') THEN
    ALTER TABLE "two_factor_codes" ADD CONSTRAINT "two_factor_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'two_factors_user_id_users_id_fk') THEN
    ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_codes_hash_key" ON "two_factor_codes" USING btree ("code_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "two_factor_codes_user_id_idx" ON "two_factor_codes" USING btree ("user_id");
