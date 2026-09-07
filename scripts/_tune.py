import io, json

def edit(path, *pairs):
    s = io.open(path, encoding="utf-8").read()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f"NOT FOUND in {path}:\n{old[:120]}")
        s = s.replace(old, new, 1)
    io.open(path, "w", encoding="utf-8", newline="\n").write(s)

# ---------------------------------------------------------------- session ---
edit("src/auth/session.ts",
  ('''  theme: "dark" | "light" | "sepia";
};''',
   '''  theme: "dark" | "light" | "sepia";
  /** Whether a milestone is allowed to make a sound on this account. */
  celebrationSound: boolean;
};'''),
  ('''      theme: profiles.theme,
    })''',
   '''      theme: profiles.theme,
      celebrationSound: profiles.celebrationSound,
    })'''),
  ('''    theme: row.theme ?? "dark",
  };''',
   '''    theme: row.theme ?? "dark",
    celebrationSound: row.celebrationSound ?? true,
  };'''),
)
print("session: carries the sound preference")

# ---------------------------------------------------------------- action ----
edit("src/app/[locale]/app/settings/actions.ts",
  ('''  reminders: z.string().optional(),
  weekly: z.string().optional(),
});''',
   '''  reminders: z.string().optional(),
  weekly: z.string().optional(),
  sound: z.string().optional(),
});'''),
  ('''  const { displayName, studyTime, reciter, timeZone, reminders, weekly } = parsed.data;''',
   '''  const { displayName, studyTime, reciter, timeZone, reminders, weekly, sound } = parsed.data;'''),
  ('''          remindersEnabled: reminders === "on",
          weeklyEmail: weekly === "on",''',
   '''          remindersEnabled: reminders === "on",
          weeklyEmail: weekly === "on",
          celebrationSound: sound === "on",'''),
)
print("settings action: saves it")

# ------------------------------------------------------------ settings page -
edit("src/app/[locale]/app/settings/page.tsx",
  ('''      reminders: profiles.remindersEnabled,
      weekly: profiles.weeklyEmail,''',
   '''      reminders: profiles.remindersEnabled,
      weekly: profiles.weeklyEmail,
      sound: profiles.celebrationSound,'''),
  ('''                weekly={profile?.weekly ?? true}''',
   '''                weekly={profile?.weekly ?? true}
                sound={profile?.sound ?? true}'''),
)
print("settings page: passes it")

# ------------------------------------------------------------ settings form -
edit("src/components/app/settings-form.tsx",
  ('''  reminders,
  weekly,''',
   '''  reminders,
  weekly,
  sound,'''),
  ('''  reminders: boolean;
  weekly: boolean;''',
   '''  reminders: boolean;
  weekly: boolean;
  sound: boolean;'''),
  ('''        <Switch
          name="weekly"
          defaultChecked={weekly}
          label={t("weekly")}
          hint={t("weeklyHint")}''',
   '''        <Switch
          name="sound"
          defaultChecked={sound}
          label={t("sound")}
          hint={t("soundHint")}
        />

        <Switch
          name="weekly"
          defaultChecked={weekly}
          label={t("weekly")}
          hint={t("weeklyHint")}'''),
)
print("settings form: shows the switch")

# ----------------------------------------------------------------- layout ---
edit("src/app/[locale]/app/layout.tsx",
  ('''  const juz = await juzProgress(user.id);

  return (
    <>
      {children}''',
   '''  const juz = await juzProgress(user.id);

  return (
    <>
      {/* The celebration is drawn outside React, by a module with no way to
          read a server value — so the answer is stamped on the window before
          anything can ask for it. A script rather than a data attribute
          because the element it would sit on belongs to the root layout,
          which does not know who is signed in. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__ahdSound=${user.celebrationSound ? "true" : "false"}`,
        }}
      />
      {children}'''),
)
print("layout: stamps it on the window")

# -------------------------------------------------------------- celebrate ---
edit("src/lib/celebrate.ts",
  ('''export function chime(tier: Tier) {
  try {''',
   '''export function chime(tier: Tier) {
  /* Silence is a setting, and it is checked here rather than at every call
     site so that no future caller can forget it. */
  if ((window as unknown as { __ahdSound?: boolean }).__ahdSound === false) return;

  try {'''),
)
print("celebrate: obeys it")

# ------------------------------------------------------------------- copy ---
copy = {
    "en": ("Celebration sound", "A bell when a page or a juz is finished. Off in a lesson, on at home."),
    "uz": ("Tabrik ovozi", "Sahifa yoki juz tugaganda jaranglaydi. Darsda o‘chirib qo‘ying."),
    "ru": ("Звук поздравления", "Колокольчик, когда страница или джуз завершён. На уроке — выключите."),
}
for lang, (label, hint) in copy.items():
    q = f"messages/{lang}.json"
    m = json.load(io.open(q, encoding="utf-8"))
    m["app"]["settings"]["sound"] = label
    m["app"]["settings"]["soundHint"] = hint
    io.open(q, "w", encoding="utf-8", newline="\n").write(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
print("copy: three languages")
