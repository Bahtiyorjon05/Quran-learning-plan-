CREATE TYPE "public"."auth_event_kind" AS ENUM('signup', 'login_success', 'login_failure', 'logout', 'logout_all', 'email_verified', 'verification_resent', 'password_reset_requested', 'password_reset_completed', 'password_changed', 'account_locked', 'account_deleted');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('uz', 'en', 'ru');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('dark', 'light', 'sepia');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'teacher', 'admin');--> statement-breakpoint
CREATE TYPE "public"."amendment_kind" AS ENUM('created', 'shortened', 'scope_reduced', 'rukhsah_spent', 'abandoned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."daily_unit" AS ENUM('lines', 'pages', 'ayahs');--> statement-breakpoint
CREATE TYPE "public"."manzil_cycle" AS ENUM('adaptive', 'classic');--> statement-breakpoint
CREATE TYPE "public"."plan_day_status" AS ENUM('pending', 'complete', 'partial', 'missed', 'rukhsah');--> statement-breakpoint
CREATE TYPE "public"."plan_scope" AS ENUM('full', 'juz_range', 'surah_set');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."mistake_kind" AS ENUM('forgot', 'swapped', 'tajweed', 'mutashabih');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('sabaq', 'sabqi', 'manzil', 'test');--> statement-breakpoint
CREATE TYPE "public"."unit_state" AS ENUM('new', 'learning', 'memorized');--> statement-breakpoint
CREATE TABLE "auth_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid,
	"email" text,
	"kind" "auth_event_kind" NOT NULL,
	"ip" text,
	"user_agent" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_codes_attempts_sane" CHECK ("email_verification_codes"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "password_reset_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_codes_attempts_sane" CHECK ("password_reset_codes"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"locale" "locale" DEFAULT 'uz' NOT NULL,
	"theme" "theme" DEFAULT 'dark' NOT NULL,
	"time_zone" text DEFAULT 'Asia/Tashkent' NOT NULL,
	"preferred_reciter" text DEFAULT 'alafasy' NOT NULL,
	"arabic_font_scale" smallint DEFAULT 100 NOT NULL,
	"translation_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"study_time" time,
	"reminders_enabled" boolean DEFAULT true NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_complete_date" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"display_name" text,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_email_shape" CHECK ("users"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
	CONSTRAINT "users_failed_login_count_sane" CHECK ("users"."failed_login_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plan_amendments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"plan_id" uuid NOT NULL,
	"kind" "amendment_kind" NOT NULL,
	"old_end_date" date,
	"new_end_date" date,
	"old_total_lines" integer,
	"new_total_lines" integer,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_amendments_never_extends" CHECK ("plan_amendments"."old_end_date" is null or "plan_amendments"."new_end_date" is null or "plan_amendments"."new_end_date" <= "plan_amendments"."old_end_date"),
	CONSTRAINT "plan_amendments_never_grows_scope" CHECK ("plan_amendments"."old_total_lines" is null or "plan_amendments"."new_total_lines" is null or "plan_amendments"."new_total_lines" <= "plan_amendments"."old_total_lines")
);
--> statement-breakpoint
CREATE TABLE "plan_days" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sabaq_from_line" integer,
	"sabaq_to_line" integer,
	"sabqi_pages" smallint[],
	"manzil_pages" smallint[],
	"sabaq_done" timestamp with time zone,
	"sabqi_done" timestamp with time zone,
	"manzil_done" timestamp with time zone,
	"status" "plan_day_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_days_sabaq_range_valid" CHECK (("plan_days"."sabaq_from_line" is null and "plan_days"."sabaq_to_line" is null) or ("plan_days"."sabaq_from_line" >= 1 and "plan_days"."sabaq_to_line" >= "plan_days"."sabaq_from_line"))
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "plan_scope" DEFAULT 'full' NOT NULL,
	"scope_from_page" smallint DEFAULT 1 NOT NULL,
	"scope_to_page" smallint DEFAULT 604 NOT NULL,
	"scope_surahs" smallint[],
	"total_lines" integer NOT NULL,
	"completed_lines" integer DEFAULT 0 NOT NULL,
	"niyyah" text,
	"start_date" date NOT NULL,
	"original_end_date" date NOT NULL,
	"current_end_date" date NOT NULL,
	"daily_unit" "daily_unit" DEFAULT 'lines' NOT NULL,
	"study_days_mask" smallint DEFAULT 127 NOT NULL,
	"manzil_cycle" "manzil_cycle" DEFAULT 'adaptive' NOT NULL,
	"rukhsah_budget" smallint DEFAULT 12 NOT NULL,
	"rukhsah_used" smallint DEFAULT 0 NOT NULL,
	"scope_reductions_used" smallint DEFAULT 0 NOT NULL,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_deadline_never_extended" CHECK ("plans"."current_end_date" <= "plans"."original_end_date"),
	CONSTRAINT "plans_deadline_after_start" CHECK ("plans"."current_end_date" >= "plans"."start_date"),
	CONSTRAINT "plans_original_deadline_after_start" CHECK ("plans"."original_end_date" >= "plans"."start_date"),
	CONSTRAINT "plans_rukhsah_within_budget" CHECK ("plans"."rukhsah_used" <= "plans"."rukhsah_budget"),
	CONSTRAINT "plans_rukhsah_used_non_negative" CHECK ("plans"."rukhsah_used" >= 0),
	CONSTRAINT "plans_rukhsah_budget_range" CHECK ("plans"."rukhsah_budget" between 0 and 24),
	CONSTRAINT "plans_scope_reduced_at_most_once" CHECK ("plans"."scope_reductions_used" between 0 and 1),
	CONSTRAINT "plans_total_lines_positive" CHECK ("plans"."total_lines" > 0),
	CONSTRAINT "plans_completed_lines_in_range" CHECK ("plans"."completed_lines" between 0 and "plans"."total_lines"),
	CONSTRAINT "plans_page_range_valid" CHECK ("plans"."scope_from_page" between 1 and 604 and "plans"."scope_to_page" between 1 and 604 and "plans"."scope_from_page" <= "plans"."scope_to_page"),
	CONSTRAINT "plans_study_days_mask_range" CHECK ("plans"."study_days_mask" between 1 and 127)
);
--> statement-breakpoint
CREATE TABLE "memorization_units" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"page" smallint NOT NULL,
	"state" "unit_state" DEFAULT 'new' NOT NULL,
	"strength" smallint DEFAULT 0 NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"interval_days" real DEFAULT 0 NOT NULL,
	"first_memorized_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"next_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memorization_units_page_range" CHECK ("memorization_units"."page" between 1 and 604),
	CONSTRAINT "memorization_units_strength_range" CHECK ("memorization_units"."strength" between 0 and 100),
	CONSTRAINT "memorization_units_ease_range" CHECK ("memorization_units"."ease" between 1.3 and 3.0),
	CONSTRAINT "memorization_units_counters_non_negative" CHECK ("memorization_units"."reps" >= 0 and "memorization_units"."lapses" >= 0)
);
--> statement-breakpoint
CREATE TABLE "mistakes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"page" smallint NOT NULL,
	"surah" smallint NOT NULL,
	"ayah" smallint NOT NULL,
	"word_index" smallint,
	"kind" "mistake_kind" NOT NULL,
	"linked_surah" smallint,
	"linked_ayah" smallint,
	"note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mistakes_surah_range" CHECK ("mistakes"."surah" between 1 and 114),
	CONSTRAINT "mistakes_ayah_positive" CHECK ("mistakes"."ayah" >= 1),
	CONSTRAINT "mistakes_page_range" CHECK ("mistakes"."page" between 1 and 604)
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"page" smallint NOT NULL,
	"type" "review_type" NOT NULL,
	"quality" smallint NOT NULL,
	"mistake_count" integer DEFAULT 0 NOT NULL,
	"duration_sec" integer,
	"strength_before" smallint NOT NULL,
	"strength_after" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_logs_quality_range" CHECK ("review_logs"."quality" between 0 and 5),
	CONSTRAINT "review_logs_mistake_count_non_negative" CHECK ("review_logs"."mistake_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_amendments" ADD CONSTRAINT "plan_amendments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorization_units" ADD CONSTRAINT "memorization_units_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_unit_id_memorization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."memorization_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_events_user_id_created_at_idx" ON "auth_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auth_events_kind_created_at_idx" ON "auth_events" USING btree ("kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auth_events_email_idx" ON "auth_events" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_codes_hash_key" ON "email_verification_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "email_verification_codes_user_id_idx" ON "email_verification_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_codes_hash_key" ON "password_reset_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "password_reset_codes_user_id_idx" ON "password_reset_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "plan_amendments_plan_id_created_at_idx" ON "plan_amendments" USING btree ("plan_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "plan_days_plan_id_date_key" ON "plan_days" USING btree ("plan_id","date");--> statement-breakpoint
CREATE INDEX "plan_days_plan_id_status_idx" ON "plan_days" USING btree ("plan_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_active_per_user" ON "plans" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "plans_user_id_idx" ON "plans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memorization_units_user_page_key" ON "memorization_units" USING btree ("user_id","page");--> statement-breakpoint
CREATE INDEX "memorization_units_user_due_idx" ON "memorization_units" USING btree ("user_id","next_due_at");--> statement-breakpoint
CREATE INDEX "memorization_units_user_strength_idx" ON "memorization_units" USING btree ("user_id","strength");--> statement-breakpoint
CREATE INDEX "mistakes_user_created_at_idx" ON "mistakes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mistakes_user_page_idx" ON "mistakes" USING btree ("user_id","page");--> statement-breakpoint
CREATE INDEX "review_logs_user_created_at_idx" ON "review_logs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "review_logs_unit_id_idx" ON "review_logs" USING btree ("unit_id");