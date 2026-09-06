CREATE TABLE IF NOT EXISTS "juz_milestones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"juz" smallint NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	CONSTRAINT "juz_milestones_range" CHECK ("juz_milestones"."juz" between 1 and 30)
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'juz_milestones_user_id_users_id_fk') THEN
    ALTER TABLE "juz_milestones" ADD CONSTRAINT "juz_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "juz_milestones_user_juz_key" ON "juz_milestones" USING btree ("user_id","juz");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juz_milestones_user_idx" ON "juz_milestones" USING btree ("user_id");
