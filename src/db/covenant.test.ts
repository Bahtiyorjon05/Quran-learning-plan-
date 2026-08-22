import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { plans, planAmendments, users } from "./schema";

/**
 * The covenant, tested against the real database.
 *
 * These are not unit tests of application code — they deliberately bypass the
 * app entirely and write straight to Postgres, because the whole claim of this
 * product is that no path exists to extend a deadline. If a rule only holds in
 * a server action, it does not hold.
 */

const EMAIL = `covenant-test-${Date.now()}@ahd.test`;

let userId: string;
let planId: string;

/**
 * Drizzle wraps driver failures in a DrizzleQueryError, so the Postgres
 * SQLSTATE sits somewhere down the `cause` chain rather than on the error we
 * catch. Walk the chain to find it.
 */
function sqlStateOf(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 6; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code.length === 5) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Assert that a statement fails with one of our custom SQLSTATEs. */
async function expectSqlState(code: string, run: () => Promise<unknown>) {
  let thrown: unknown;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown, `expected SQLSTATE ${code}, but the statement succeeded`).toBeDefined();
  expect(
    sqlStateOf(thrown),
    `expected SQLSTATE ${code}, got: ${(thrown as Error)?.message}`,
  ).toBe(code);
}

async function amendmentKinds() {
  const rows = await db
    .select({ kind: planAmendments.kind })
    .from(planAmendments)
    .where(eq(planAmendments.planId, planId))
    .orderBy(planAmendments.createdAt);
  return rows.map((r) => r.kind);
}

async function currentPlan() {
  const [row] = await db.select().from(plans).where(eq(plans.id, planId));
  return row;
}

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({ email: EMAIL, passwordHash: "not-a-real-hash" })
    .returning({ id: users.id });
  userId = user.id;

  const [plan] = await db
    .insert(plans)
    .values({
      userId,
      scope: "full",
      totalLines: 9060,
      startDate: "2026-01-01",
      originalEndDate: "2029-01-01",
      currentEndDate: "2029-01-01",
      rukhsahBudget: 12,
    })
    .returning({ id: plans.id });
  planId = plan.id;
});

afterAll(async () => {
  if (userId) await db.delete(users).where(eq(users.id, userId));
});

describe("creating a covenant", () => {
  it("writes its own first amendment", async () => {
    expect(await amendmentKinds()).toEqual(["created"]);
  });

  it("refuses a plan whose two deadlines disagree at signing", async () => {
    await expectSqlState("AH002", () =>
      db.insert(plans).values({
        userId,
        totalLines: 9060,
        startDate: "2026-01-01",
        originalEndDate: "2029-01-01",
        currentEndDate: "2028-01-01",
      }),
    );
  });

  it("allows only one active plan per user", async () => {
    let failed = false;
    try {
      await db.insert(plans).values({
        userId,
        totalLines: 9060,
        startDate: "2026-01-01",
        originalEndDate: "2030-01-01",
        currentEndDate: "2030-01-01",
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});

describe("the deadline moves one way only", () => {
  it("REFUSES an extension, even in raw SQL", async () => {
    await expectSqlState("AH001", () =>
      db.execute(
        sql`update plans set current_end_date = '2031-01-01' where id = ${planId}`,
      ),
    );
  });

  it("refuses an extension by a single day", async () => {
    await expectSqlState("AH001", () =>
      db.execute(
        sql`update plans set current_end_date = current_end_date + 1 where id = ${planId}`,
      ),
    );
  });

  it("accepts an acceleration and logs it without being asked", async () => {
    await db
      .update(plans)
      .set({ currentEndDate: "2028-07-01" })
      .where(eq(plans.id, planId));

    expect((await currentPlan()).currentEndDate).toBe("2028-07-01");
    expect(await amendmentKinds()).toEqual(["created", "shortened"]);
  });

  it("still refuses an extension back to where it started", async () => {
    await expectSqlState("AH001", () =>
      db
        .update(plans)
        .set({ currentEndDate: "2029-01-01" })
        .where(eq(plans.id, planId)),
    );
  });

  it("refuses to rewrite the original deadline", async () => {
    await expectSqlState("AH002", () =>
      db.execute(
        sql`update plans set original_end_date = '2035-01-01' where id = ${planId}`,
      ),
    );
  });

  it("refuses to move the start date", async () => {
    await expectSqlState("AH002", () =>
      db.execute(sql`update plans set start_date = '2027-01-01' where id = ${planId}`),
    );
  });
});

describe("scope may shrink, exactly once, and never grow", () => {
  it("refuses to grow the scope", async () => {
    await expectSqlState("AH003", () =>
      db.execute(sql`update plans set total_lines = 12000 where id = ${planId}`),
    );
  });

  it("refuses a shrink that does not spend the one reduction", async () => {
    await expectSqlState("AH004", () =>
      db.execute(sql`update plans set total_lines = 4530 where id = ${planId}`),
    );
  });

  it("accepts the first reduction and logs it", async () => {
    await db
      .update(plans)
      .set({ totalLines: 4530, scopeReductionsUsed: 1 })
      .where(eq(plans.id, planId));

    expect((await currentPlan()).totalLines).toBe(4530);
    expect(await amendmentKinds()).toEqual(["created", "shortened", "scope_reduced"]);
  });

  it("refuses a second reduction", async () => {
    await expectSqlState("AH004", () =>
      db.execute(
        sql`update plans set total_lines = 2000, scope_reductions_used = 2 where id = ${planId}`,
      ),
    );
  });
});

describe("rukhsah days", () => {
  it("refuses to top up the budget", async () => {
    await expectSqlState("AH005", () =>
      db.execute(sql`update plans set rukhsah_budget = 40 where id = ${planId}`),
    );
  });

  it("spends one day and logs it", async () => {
    await db.update(plans).set({ rukhsahUsed: 1 }).where(eq(plans.id, planId));
    expect(await amendmentKinds()).toContain("rukhsah_spent");
  });

  it("refuses to spend several at once", async () => {
    await expectSqlState("AH005", () =>
      db.execute(sql`update plans set rukhsah_used = 6 where id = ${planId}`),
    );
  });

  it("refuses a refund", async () => {
    await expectSqlState("AH005", () =>
      db.execute(sql`update plans set rukhsah_used = 0 where id = ${planId}`),
    );
  });
});

describe("the amendment log is append-only", () => {
  it("refuses an edit", async () => {
    await expectSqlState("AH007", () =>
      db.execute(
        sql`update plan_amendments set reason = 'tampered' where plan_id = ${planId}`,
      ),
    );
  });

  it("refuses a delete while the plan still exists", async () => {
    await expectSqlState("AH007", () =>
      db.execute(sql`delete from plan_amendments where plan_id = ${planId}`),
    );
  });
});

describe("a finished plan is final", () => {
  it("accepts abandonment and logs it", async () => {
    await db
      .update(plans)
      .set({ status: "abandoned", abandonedAt: new Date() })
      .where(eq(plans.id, planId));

    expect(await amendmentKinds()).toContain("abandoned");
  });

  it("refuses to reopen it", async () => {
    await expectSqlState("AH006", () =>
      db.update(plans).set({ status: "active" }).where(eq(plans.id, planId)),
    );
  });

  it("refuses to edit it", async () => {
    await expectSqlState("AH006", () =>
      db.execute(
        sql`update plans set current_end_date = '2027-01-01' where id = ${planId}`,
      ),
    );
  });

  it("frees the one-active-plan slot so a new covenant can begin", async () => {
    const [next] = await db
      .insert(plans)
      .values({
        userId,
        totalLines: 9060,
        startDate: "2026-06-01",
        originalEndDate: "2028-06-01",
        currentEndDate: "2028-06-01",
      })
      .returning({ id: plans.id });
    expect(next.id).toBeTruthy();
  });
});

describe("a user can still erase themselves completely", () => {
  it("cascades through the append-only log", async () => {
    await db.delete(users).where(eq(users.id, userId));

    const remaining = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(planAmendments)
      .where(eq(planAmendments.planId, planId));
    expect(remaining[0].n).toBe(0);

    const plansLeft = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(plans)
      .where(and(eq(plans.userId, userId)));
    expect(plansLeft[0].n).toBe(0);

    userId = "";
  });
});
