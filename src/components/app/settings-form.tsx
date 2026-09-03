"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";

import { RECITERS } from "@/lib/reciters";
import { Field, TextInput } from "@/components/ui/field";
import { buttonStyles } from "@/components/ui/button";
import { saveSettings } from "@/app/[locale]/app/settings/actions";
import { SETTINGS_IDLE } from "@/core/profile/settings-state";
import { cn } from "@/lib/utils";

import { NotificationSetting } from "./notification-setting";

/**
 * The preferences, in one form.
 *
 * One save for everything rather than a switch that writes the moment it is
 * touched: half of these change what "today" means or who the dashboard greets,
 * and a setting that saves itself while somebody is still deciding is a setting
 * they cannot back out of.
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
}: {
  displayName: string;
  email: string;
  studyTime: string;
  reciter: string;
  timeZone: string;
  reminders: boolean;
  weekly: boolean;
}) {
  const t = useTranslations("settings");
  const locale = useLocale() as "uz" | "en" | "ru";

  const [state, action, pending] = useActionState(saveSettings, SETTINGS_IDLE);

  /* Somebody who has moved should not have to find their own zone in a list of
     seventeen: theirs is added if it is not already among them. */
  const zones = ZONES.includes(timeZone as (typeof ZONES)[number])
    ? ZONES
    : [timeZone, ...ZONES];

  return (
    <form action={action} className="space-y-5">
      <Section title={t("you")}>
        <Field label={t("name")} htmlFor="displayName" hint={t("nameHint")}>
          <TextInput
            id="displayName"
            name="displayName"
            defaultValue={displayName}
            maxLength={60}
            required
            autoComplete="name"
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
            className="h-11 w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-inset)]/60 px-4 text-[0.9375rem] text-[var(--text-strong)] tabular-nums transition-colors duration-300 focus:border-[var(--accent)] focus:outline-none"
          />
        </Field>

        <Field label={t("reciter")} htmlFor="reciter">
          <Select id="reciter" name="reciter" defaultValue={reciter}>
            {RECITERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name[locale]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("timeZone")} htmlFor="timeZone" hint={t("timeZoneHint")}>
          <Select id="timeZone" name="timeZone" defaultValue={timeZone}>
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
        />
        <Switch
          name="weekly"
          defaultChecked={weekly}
          label={t("weekly")}
          hint={t("weeklyHint")}
        />

        {/* The browser's own permission, which no form can set. */}
        <NotificationSetting />
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles({ size: "lg" })}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {pending ? t("saving") : t("save")}
        </button>

        {state.status === "saved" && !pending && (
          <span className="text-[0.875rem] text-[var(--accent-strong)]">{t("saved")}</span>
        )}
        {state.status === "error" && !pending && (
          <span className="text-[0.875rem] text-danger">{t("failed")}</span>
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
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5">
      <input
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
