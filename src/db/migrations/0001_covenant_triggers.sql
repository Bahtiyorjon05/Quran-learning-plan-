-- ════════════════════════════════════════════════════════════════════════════
--  THE COVENANT
--
--  The CHECK constraints in 0000 catch bad *data*. These triggers catch bad
--  *transitions*, which is where the one-way rule actually lives: nothing in
--  a snapshot of a row tells you whether its deadline just moved the wrong way.
--
--  Everything here is enforced below the application. There is no ORM call, no
--  raw query, and no psql session that can extend a deadline, refund a rukhsah
--  day, or quietly rewrite a covenant's history.
--
--  Custom SQLSTATEs so the app can translate failures into human messages:
--    AH001  deadline extension attempted
--    AH002  immutable covenant term altered
--    AH003  scope grew
--    AH004  scope reduction misused or exhausted
--    AH005  rukhsah budget misused
--    AH006  a finished plan was modified
--    AH007  append-only table written to
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ahd_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- ── At signing, the two deadlines must agree ────────────────────────────────
CREATE OR REPLACE FUNCTION ahd_plan_insert_guard() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.current_end_date <> NEW.original_end_date THEN
    RAISE EXCEPTION
      'A new covenant must start with current_end_date = original_end_date (got % and %)',
      NEW.current_end_date, NEW.original_end_date
      USING ERRCODE = 'AH002';
  END IF;

  IF NEW.rukhsah_used <> 0 OR NEW.scope_reductions_used <> 0 THEN
    RAISE EXCEPTION 'A new covenant must start with no concessions spent'
      USING ERRCODE = 'AH002';
  END IF;

  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- ── The rule itself ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ahd_plan_covenant_guard() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  -- Terms agreed at signing are frozen for the life of the plan.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A plan cannot change owner'
      USING ERRCODE = 'AH002';
  END IF;

  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    RAISE EXCEPTION 'start_date is fixed when the covenant is made (% -> %)',
      OLD.start_date, NEW.start_date
      USING ERRCODE = 'AH002';
  END IF;

  IF NEW.original_end_date IS DISTINCT FROM OLD.original_end_date THEN
    RAISE EXCEPTION
      'original_end_date is the covenant itself and can never be rewritten (% -> %)',
      OLD.original_end_date, NEW.original_end_date
      USING ERRCODE = 'AH002';
  END IF;

  IF NEW.rukhsah_budget IS DISTINCT FROM OLD.rukhsah_budget THEN
    RAISE EXCEPTION
      'The rukhsah budget is fixed at creation and can never be topped up (% -> %)',
      OLD.rukhsah_budget, NEW.rukhsah_budget
      USING ERRCODE = 'AH005';
  END IF;

  -- ── THE RULE ──
  IF NEW.current_end_date > OLD.current_end_date THEN
    RAISE EXCEPTION 'A deadline may only ever move closer. Refused: % -> %',
      OLD.current_end_date, NEW.current_end_date
      USING ERRCODE = 'AH001',
            HINT = 'Scope may shrink; time may never grow.';
  END IF;

  -- ── Scope may shrink, exactly once, and never grow ──
  IF NEW.total_lines > OLD.total_lines THEN
    RAISE EXCEPTION 'A plan''s scope may never grow (% -> % lines)',
      OLD.total_lines, NEW.total_lines
      USING ERRCODE = 'AH003';
  END IF;

  IF NEW.total_lines < OLD.total_lines THEN
    IF OLD.scope_reductions_used >= 1 THEN
      RAISE EXCEPTION 'This plan has already used its one scope reduction'
        USING ERRCODE = 'AH004';
    END IF;
    IF NEW.scope_reductions_used <> OLD.scope_reductions_used + 1 THEN
      RAISE EXCEPTION 'Reducing scope must consume exactly one scope reduction'
        USING ERRCODE = 'AH004';
    END IF;
  ELSIF NEW.scope_reductions_used IS DISTINCT FROM OLD.scope_reductions_used THEN
    RAISE EXCEPTION 'scope_reductions_used only moves when the scope actually shrinks'
      USING ERRCODE = 'AH004';
  END IF;

  -- ── Rukhsah days are spent one at a time and never refunded ──
  IF NEW.rukhsah_used < OLD.rukhsah_used THEN
    RAISE EXCEPTION 'Rukhsah days cannot be refunded (% -> %)',
      OLD.rukhsah_used, NEW.rukhsah_used
      USING ERRCODE = 'AH005';
  END IF;

  IF NEW.rukhsah_used > OLD.rukhsah_used + 1 THEN
    RAISE EXCEPTION 'Rukhsah days are spent one at a time (% -> %)',
      OLD.rukhsah_used, NEW.rukhsah_used
      USING ERRCODE = 'AH005';
  END IF;

  -- ── Finished is finished ──
  IF OLD.status <> 'active' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A % plan is final and cannot be reopened', OLD.status
        USING ERRCODE = 'AH006';
    END IF;

    IF NEW.current_end_date IS DISTINCT FROM OLD.current_end_date
       OR NEW.total_lines IS DISTINCT FROM OLD.total_lines
       OR NEW.completed_lines IS DISTINCT FROM OLD.completed_lines
       OR NEW.rukhsah_used IS DISTINCT FROM OLD.rukhsah_used THEN
      RAISE EXCEPTION 'A % plan cannot be edited', OLD.status
        USING ERRCODE = 'AH006';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- ── The history writes itself ───────────────────────────────────────────────
-- Application code never inserts into plan_amendments. It may optionally
-- explain itself first:
--     set local ahd.amendment_reason = 'Ramadan push';
CREATE OR REPLACE FUNCTION ahd_plan_amendment_log() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  reason text := nullif(current_setting('ahd.amendment_reason', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO plan_amendments
      (plan_id, kind, old_end_date, new_end_date, old_total_lines, new_total_lines, reason)
    VALUES
      (NEW.id, 'created', NEW.original_end_date, NEW.current_end_date,
       NEW.total_lines, NEW.total_lines, reason);
    RETURN NEW;
  END IF;

  IF NEW.total_lines < OLD.total_lines THEN
    INSERT INTO plan_amendments
      (plan_id, kind, old_end_date, new_end_date, old_total_lines, new_total_lines, reason)
    VALUES
      (NEW.id, 'scope_reduced', OLD.current_end_date, NEW.current_end_date,
       OLD.total_lines, NEW.total_lines, reason);
  ELSIF NEW.current_end_date < OLD.current_end_date THEN
    INSERT INTO plan_amendments
      (plan_id, kind, old_end_date, new_end_date, reason)
    VALUES
      (NEW.id, 'shortened', OLD.current_end_date, NEW.current_end_date, reason);
  END IF;

  IF NEW.rukhsah_used > OLD.rukhsah_used THEN
    INSERT INTO plan_amendments (plan_id, kind, reason)
    VALUES (NEW.id, 'rukhsah_spent', reason);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'abandoned' THEN
      INSERT INTO plan_amendments (plan_id, kind, reason)
      VALUES (NEW.id, 'abandoned', reason);
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO plan_amendments (plan_id, kind, reason)
      VALUES (NEW.id, 'completed', reason);
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- ── plan_amendments is append-only ──────────────────────────────────────────
-- DELETE is permitted only when the parent plan has already gone, which means
-- we are inside a cascade from deleting the plan or the whole account. A user
-- must always be able to erase themselves completely.
CREATE OR REPLACE FUNCTION ahd_amendments_append_only() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM plans WHERE id = OLD.plan_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'plan_amendments is append-only: an amendment cannot be deleted'
      USING ERRCODE = 'AH007';
  END IF;

  RAISE EXCEPTION 'plan_amendments is append-only: an amendment cannot be edited'
    USING ERRCODE = 'AH007';
END;
$fn$;
--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════════════
--  WIRING
-- ════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER plans_insert_guard
  BEFORE INSERT ON plans
  FOR EACH ROW EXECUTE FUNCTION ahd_plan_insert_guard();
--> statement-breakpoint

CREATE TRIGGER plans_covenant_guard
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION ahd_plan_covenant_guard();
--> statement-breakpoint

CREATE TRIGGER plans_amendment_log_insert
  AFTER INSERT ON plans
  FOR EACH ROW EXECUTE FUNCTION ahd_plan_amendment_log();
--> statement-breakpoint

CREATE TRIGGER plans_amendment_log_update
  AFTER UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION ahd_plan_amendment_log();
--> statement-breakpoint

CREATE TRIGGER plan_amendments_append_only
  BEFORE UPDATE OR DELETE ON plan_amendments
  FOR EACH ROW EXECUTE FUNCTION ahd_amendments_append_only();
--> statement-breakpoint

CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION ahd_touch_updated_at();
--> statement-breakpoint

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION ahd_touch_updated_at();
--> statement-breakpoint

CREATE TRIGGER memorization_units_touch_updated_at
  BEFORE UPDATE ON memorization_units
  FOR EACH ROW EXECUTE FUNCTION ahd_touch_updated_at();
