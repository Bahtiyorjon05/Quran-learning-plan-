"use client";

import { logoutAction } from "@/app/[locale]/app/actions";

/**
 * "Not you?" on a screen you are half-way into.
 *
 * Somebody stopped at the second password may be at a shared machine, or may
 * simply be on the wrong account. The way out has to be on this screen —
 * everything else is behind the wall they cannot pass.
 */
export function LogoutLink({ label }: { label: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="font-medium text-[var(--accent-strong)] transition-colors hover:underline"
      >
        {label}
      </button>
    </form>
  );
}
