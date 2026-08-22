import type { AuthErrorCode } from "./errors";

/**
 * The shape every auth form speaks, and its initial value.
 *
 * This lives OUTSIDE the "use server" action files on purpose. A "use server"
 * module may only export async functions — Next validates that when the module
 * loads on an action POST, and an object export like IDLE makes the whole
 * module refuse to load:
 *
 *   Error: A "use server" file can only export async functions, found object.
 *   digest: …@E352
 *
 * The cruelty of that failure is its timing: every page GET renders fine, and
 * the crash appears only on the first real form submission.
 *
 * `error` and `fieldErrors` carry translation *keys*, never sentences — the
 * server has no business deciding which of three languages the visitor reads,
 * and a key survives a locale switch that a baked-in string would not.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  /** Key under `auth.errors`, plus any values its message interpolates. */
  error?: { code: AuthErrorCode; values?: Record<string, string | number> };
  /** Field name → key under `auth.validation`. */
  fieldErrors?: Record<string, string>;
  /** Key under `auth.<page>` for a success line, e.g. a resent code. */
  notice?: string;
};

export const IDLE: FormState = { status: "idle" };

export type OnboardingState = {
  status: "idle" | "error";
  fieldErrors?: Record<string, string>;
};

export const ONBOARDING_IDLE: OnboardingState = { status: "idle" };
