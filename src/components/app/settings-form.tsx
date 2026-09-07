"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2, TriangleAlert } from "lucide-react";

import { RECITERS } from "@/lib/reciters";
import { Field, TextInput } from "@/components/ui/field";
import { saveSettings } from "@/app/[locale]/app/settings/actions";
import { SETTINGS_IDLE } from "@/core/profile/settings-state";
import { cn } from "@/lib/utils";

import { NotificationSetting } from "./notification-setting";

/**
 * The preferences, saving themselves.
 *
 * There is no button. A settings screen that asks you to press Save is asking
 * you to do bookkeeping on its behalf — and the commonest outcome is somebody
 * changing their reciter, navigating away, and finding it unchanged.
 *
 * Two speeds, because two kinds of control:
 *
 *   A switch, a select and a time are *decisions*. They are done the instant
 *   they change, so they are written then.
 *
 *   A name is typed, one letter at a time. Writing on every keystroke would be
 *   twelve requests for one word, so it waits until the typing stops — and
 *   also on blur, so leaving the field never loses the last letter.
 *
 * The whole form is posted each time rather than one field, because the action
 * validates the set together and a partial write could leave two fields
 * disagreeing.
 */

/* The zones this product's readers actually live in, and a few for those who
   have moved. Offered as a list because typing an IANA name from memory is not
   a thing anybody does. */
const ZONES = [
  "Asia/Tashkent",
  "Asia/Samarkand",
  "Asia/Almaty",
  "Asia/Bishkek",
  "Asia/Dushanbe",
  "Asia/Ashgabat",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Istanbul",
  "Asia/Karachi",
  "Asia/Seoul",
  "Europe/Moscow",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
] as const;

export function SettingsForm({
  displayName,
  email,
  studyTime,
  reciter,
  timeZone,
  reminders,
  weekly,
  sound,
}: {
  displayName: string;
  email: string;
  studyTime: string;
  reciter: string;
  timeZone: string;
  reminders: boolean;
  weekly: boolean;
  sound: boolean;
}) {
  const t = useTranslations("settings");
  const locale = useLocale() as "uz" | "en" | "ru";

  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const clearStatus = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (clearStatus.current) clearTimeout(clearStatus.current);
    },
    [],
  );

  /* One write at a time, and always the newest.
   *
   * Changing two things quickly started two writes at once, and the network
   * does not promise to keep them in order: the first could land last and put
   * back the value the second had just replaced. So a save in flight blocks a
   * second from starting, and anything changed meanwhile sets a flag that runs
   * one more save when the first returns — with the form as it stands then,
   * which is by definition the newest state. */
  const inFlight = useRef(false);
  /* The queued write holds its *data*, not a promise to look at the form
     again later. The action revalidates the app layout, and that refresh can
     re-apply the server's `defaultValue` to an uncontrolled input — so a
     deferred save that re-read the form could send back the value the user had
     just replaced. What was true when they changed it is what gets sent. */
  const queued = useRef<FormData | null>(null);

  /* Called directly rather than inside a transition. The action revalidates
     the app layout on its way out, and a transition wrapping it stays pending
     while that refresh settles — which left the confirmation reading "saving"
     forever, long after the write had landed. */
  async function save(carried?: FormData) {
    const node = form.current;
    if (!node && !carried) return;

    const data = carried ?? new FormData(node!);

    if (inFlight.current) {
      queued.current = data;
      return;
    }
    inFlight.current = true;

    setSaving(true);
    try {
      const result = await saveSettings(SETTINGS_IDLE, data);
      setStatus(result.status === "saved" ? "saved" : "error");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
      setSaving(false);

      const next = queued.current;
      if (next) {
        queued.current = null;
        void save(next);
        return;
      }

      /* A confirmation that never leaves stops being a confirmation. An error
         stays, because it is asking for something. */
      if (clearStatus.current) clearTimeout(clearStatus.current);
      clearStatus.current = setTimeout(
        () => setStatus((was) => (was === "saved" ? "idle" : was)),
        2600,
      );
    }
  }

  /* A decision: written the moment it is made. */
  function saveNow() {
    if (timer.current) clearTimeout(timer.current);
    save();
  }

  /* Typing: written once it stops, and again on the way out of the field so
     the last letter is never the one that is lost. */
  function saveSoon() {
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  }

  /* Somebody who has moved should not have to find their own zone in a list of
     seventeen: theirs is added if it is not already among them. */
  const zones = ZONES.includes(timeZone as (typeof ZONES)[number])
    ? ZONES
    : [timeZone, ...ZONES];

  return (
    <form ref={form} className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <Section title={t("you")}>
        <Field label={t("name")} htmlFor="displayName" hint={t("nameHint")}>
          <TextInput
            id="displayName"
            name="displayName"
            defaultValue={displayName}
            maxLength={60}
            required
            autoComplete="name"
            onChange={saveSoon}
            onBlur={saveNow}
          />
        </Field>

        <Field label={t("email")} htmlFor="email" hint={t("emailFixed")}>
          <TextInput id="email" name="email" defaultValue={email} disabled readOnly />
        </Field>
      </Section>

      <Section title={t("study")}>
        <Field label={t("studyTime")} htmlFor="studyTime" hint={t("studyTimeHint")}>
          <input
            id="studyTime"
            name="studyTime"
            type="time"
            defaultValue={studyTime}
            onChange={saveNow}
            className="h-11 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 px-4 text-[0.9375rem] text-[var(--text-strong)] tabular-nums transition-colors duration-300 focus:border-[var(--accent)] focus:outline-none"
          />
        </Field>

        <Field label={t("reciter")} htmlFor="reciter">
          <Select id="reciter" name="reciter" defaultValue={reciter} onChange={saveNow}>
            {RECITERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name[locale]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("timeZone")} htmlFor="timeZone" hint={t("timeZoneHint")}>
          <Select id="timeZone" name="timeZone" defaultValue={timeZone} onChange={saveNow}>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title={t("notifications")}>
        <Switch
          name="reminders"
          defaultChecked={reminders}
          label={t("reminders")}
          hint={t("remindersHint")}
          onChange={saveNow}
        />
        <Switch
          name="sound"
          defaultChecked={sound}
          label={t("sound")}
          hint={t("soundHint")}
          onChange={saveNow}
        />

        <Switch
          name="weekly"
          defaultChecked={weekly}
          label={t("weekly")}
          hint={t("weeklyHint")}
          onChange={saveNow}
        />

        {/* The browser's own permission, which no form can set. */}
        <NotificationSetting />
      </Section>

      {/* What the button used to say, said by the form itself. Fixed to the
          foot of the screen so it is visible wherever you happen to be
          scrolled — a confirmation you have to scroll to find confirms
          nothing. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-8"
      >
        {(saving || status !== "idle") && (
          <span
            className={cn(
              "animate-rise inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[0.8125rem] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.5)] backdrop-blur",
              status === "error"
                ? "border-danger/40 bg-[var(--surface-raised)] text-danger"
                : "border-[var(--accent)]/35 bg-[var(--surface-raised)] text-[var(--accent-strong)]",
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("saving")}
              </>
            ) : status === "error" ? (
              <>
                <TriangleAlert className="h-3.5 w-3.5" />
                {t("failed")}
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                {t("saved")}
              </>
            )}
          </span>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-3xl p-5 sm:p-6">
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
        {title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Select({
  children,
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 px-3.5 text-[0.9375rem] text-[var(--text-strong)]",
        "transition-colors duration-300 focus:border-[var(--accent)] focus:outline-none",
        className,
      )}
    >
      {children}
    </select>
  );
}

/**
 * A switch that is really a checkbox.
 *
 * Which matters: it posts with the form, it is reachable by keyboard, and it
 * carries its own label — none of which a div wired to onClick would do.
 */
function Switch({
  name,
  defaultChecked,
  label,
  hint,
  onChange,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
  onChange?: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5">
      <input
        onChange={onChange}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      {/* The knob is moved and coloured by two custom properties set on the
          track. Tailwind's `peer-checked:` compiles to a sibling selector, and
          the knob is a child of the track rather than a sibling of the input —
          so styling it directly does nothing, while properties inherit. */}
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-inset)] p-0.5 text-[var(--text-faint)] transition-colors duration-300 [--knob:0] peer-checked:border-[var(--accent)] peer-checked:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] peer-checked:text-[var(--accent)] peer-checked:[--knob:1rem] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
      >
        <span
          className="h-4.5 w-4.5 rounded-full bg-current transition-transform duration-300 ease-[var(--ease-calm)]"
          style={{ transform: "translateX(var(--knob))" }}
        />
      </span>

      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-medium text-[var(--text-strong)]">
          {label}
        </span>
        <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          {hint}
        </span>
      </span>
    </label>
  );
}
