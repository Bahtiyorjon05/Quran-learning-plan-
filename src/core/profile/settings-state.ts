/**
 * Action state for saving preferences.
 *
 * Outside the "use server" file, which may only export async functions.
 */
export type SettingsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error" };

export const SETTINGS_IDLE: SettingsState = { status: "idle" };
