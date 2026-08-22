<div align="center">

# AHD — عهد
### The Qur'an Memorization & Revision Companion

*"Ahd" (عهد) — a covenant, a binding promise.*

*"Keep renewing your covenant with the Qur'an. By Him in whose hand is the soul*
*of Muhammad, it slips away faster than camels from their tethers."*
*— al-Bukhārī 5033 · Muslim 791*

**Plan your hifz. Commit to it. Practice it. Never lose it.**

`Status: 🏗 Phase 0 in progress — see §14 Build log. This document is the contract we build against.`

</div>

---

## 0. Table of Contents

1. [What this is](#1-what-this-is)
2. [Why it exists (the problem)](#2-why-it-exists-the-problem)
3. [The core idea: the Covenant Plan](#3-the-core-idea-the-covenant-plan)
4. [The hifz engine (Sabaq / Sabqi / Manzil)](#4-the-hifz-engine)
5. [Feature catalogue](#5-feature-catalogue)
6. [Design language](#6-design-language)
7. [Technical architecture](#7-technical-architecture)
8. [Data model](#8-data-model)
9. [Qur'an content pipeline & licensing](#9-quran-content-pipeline--licensing)
10. [Roadmap & phases](#10-roadmap--phases)
11. [Deployment: Vercel → Play Store](#11-deployment-vercel--play-store)
12. [Success metrics](#12-success-metrics)
13. [Decisions locked & what is still open](#13-decisions-locked-and-what-is-still-open)
14. [Build log](#14-build-log)
15. [Running it locally](#15-running-it-locally)

---

## 1. What this is

A **free, beautiful, offline-capable website — later an Android and iOS app** — where anyone can:

- Build a personal Qur'an memorization plan — **all 30 juz in 2 years, 3 years, 5 years, or any target they choose**
- **Lock that commitment.** You may shorten the deadline. You may never extend it.
- Receive a **daily workload automatically split into new memorization, recent revision, and old revision**
- **Practice** with hide-and-reveal drills, first-word prompts, audio, self-recording, and mistake tagging
- **Mark progress** page by page, ayah by ayah — and watch a 604-tile mushaf mosaic fill up
- **See everything**: strength heatmaps, pace pressure, streaks, weak spots, forecast of khatm date
- Study **together** — halaqah circles, a teacher who verifies recitations, friendly accountability

Interface in **Uzbek (default), English and Russian** from day one. Responsive website first, then Android, then iOS — one codebase.

Not another checkbox tracker. A system that models how hifz actually works and refuses to let you drift.

---

## 2. Why it exists (the problem)

| Problem | What people do today | What Ahd does |
|---|---|---|
| No structure — "I'll memorize when I can" | Random surahs, no end date | A dated plan down to the line, generated from one goal |
| Plans quietly slip forever | Deadline moves every time it's missed | **Deadline is one-directional. It only moves closer.** |
| Memorize a lot, forget more | Revision is ad-hoc or skipped | Revision is a *first-class daily obligation*, auto-scheduled |
| No idea what's weak | Discover gaps mid-salah | Per-page strength score that decays over time; weak pages surface themselves |
| Nothing to practice against | Read the page again and hope | Six active-recall drill modes, not passive re-reading |
| Alone and unaccountable | Motivation dies in week 3 | Halaqah circles, teacher verification, streaks, public commitment |
| Data trapped in a notebook | Lost / no insight | Full history, exportable, syncs offline ↔ cloud |

---

## 3. The core idea: the Covenant Plan

This is the feature that defines the product. Everything else supports it.

### 3.1 Creating a plan

A wizard, once:

1. **Niyyah** — write your intention in your own words. Stored, and shown back to you on hard days.
2. **Scope** — Full 30 juz · A juz range · Specific surahs · Juz 'Amma only · Custom set
3. **Duration** — pick years/months, or pick a daily dose and see the end date. Both directions of the same dial:
   - `604 pages ÷ 730 days` → **~0.83 pages/day** (2 years)
   - `604 pages ÷ 1095 days` → **~0.55 pages/day** (3 years)
   - Working unit is **lines**, not pages: the Madani mushaf is 604 pages × 15 lines = **9,060 lines**, so a 3-year plan is a clean **~8 lines/day** instead of an awkward fraction of a page.
4. **Rhythm** — which weekdays are memorization days, which are revision-only, preferred study time.
5. **Rukhsah budget** — grace days for illness/travel. **Declared now, fixed forever** (default 12/year).
6. **Review the covenant** — a plain summary of exactly what you are agreeing to. One confirm. Signed with a timestamp.

### 3.2 The one-way rule

```
newDeadline <= currentDeadline        ← always allowed  (acceleration)
newDeadline >  currentDeadline        ← REJECTED        (no exceptions)
```

Enforced in **three places** so it cannot be bypassed:
- UI: the date picker's `max` is today's deadline
- API: server-side validation on every plan mutation
- **Database: a `CHECK` constraint + `BEFORE UPDATE` trigger** on the plans table

Every change writes an immutable row to `plan_amendments`. Your plan has a visible history. Nothing is silently rewritten.

### 3.3 What happens when you fall behind

Time never expands, so the **workload redistributes**:

```
requiredDaily = ceil(remainingLines / remainingStudyDays)
pacePressure  = requiredDaily / originalDaily
```

The dashboard shows a live **Pace Pressure** gauge:

| Pressure | State | UI |
|---|---|---|
| `< 1.0` | **Ahead** — you've banked days | Calm green; offer to shorten the deadline |
| `1.0 – 1.2` | **On track** | Neutral |
| `1.2 – 1.5` | **Tightening** | Amber; suggest catch-up sessions |
| `> 1.5` | **At risk** | Red; honest warning + the relief valves below |

### 3.4 Rukhsah (concession) — the humane escape hatch

Real life happens. A rukhsah day:
- ✅ Protects your streak
- ✅ Removes today's obligation without marking it a failure
- ❌ Does **not** move the deadline — the load spreads across remaining days
- Costs one unit from a budget you fixed at creation and can never top up

This is the difference between discipline and cruelty. Without it, one flu abandons the app forever.

### 3.5 The only legal relief valves

When pressure is unsustainable, you may **not** buy time. You may:

1. **Reduce scope** — 30 juz → 15 juz, keeping the same deadline. Recorded permanently in plan history. *Limited to once per plan.*
2. **Abandon and restart** — the old plan stays in your history marked `abandoned`, with how far you got. Honest, never hidden.

> **Design principle: scope may shrink, time may never grow.**

---

## 4. The hifz engine

Most apps track *what you memorized*. Ahd schedules *what you must do today*, using the system real hifz schools have used for centuries — three tracks, every single day.

### 4.1 The three daily tracks

| Track | Arabic | What it is | Default rule |
|---|---|---|---|
| **Sabaq** | سبق | Today's **new** portion | Your plan's daily dose (e.g. 8 lines) |
| **Sabqi** | سبقي | **Recent** memorization, still fragile | The last **7 days** of sabaq, recited daily |
| **Manzil** | منزل | **Old** memorization, consolidated | A rotating cycle — classic: 1 juz/day → full khatm every 30 days |

The dashboard is three cards. Not a to-do list — a *daily obligation sheet*. All three must be green for the day to count.

### 4.2 Strength & decay (spaced repetition, tuned for hifz)

Every page carries a **strength score (0–100)**:

- Rises with clean recitations, falls with mistakes
- **Decays over time when untouched** — a page you haven't recited in 40 days is not the page you memorized
- Drives `nextDue`, adapted from SM-2 with hifz-specific tuning: lapses hit harder, and a page that lapses twice is force-promoted back into the **sabqi** track

This means **Manzil is not a blind rotation** — it prioritizes your weakest pages first, then fills the rest of the cycle in mushaf order.

### 4.3 The Mushaf Mosaic — the signature screen

All **604 pages as a grid of tiles**, each colored by strength:

```
░ not started   ▒ learning   ▓ memorized (weak)   █ memorized (strong)
```

Grouped by juz, with surah boundaries drawn in. Tap a tile → page detail: strength curve, last recited, mistakes logged, revise now. One glance and you know the entire state of your hifz. This is the screenshot people share.

### 4.4 Mistake intelligence

Every mistake is tagged at the word/ayah level:

- `forgot` — blanked out
- `swapped` — recited a different (usually similar) ayah
- `tajweed` — pronunciation/rules
- `mutashabih` — confused with a similar passage elsewhere

From this the app derives:
- **Weak-spot list** — your personal top 20 trouble ayahs
- **Mutashabihat detection** — when you swap ayah A for ayah B, both get linked and enter a dedicated side-by-side drill. This is the #1 pain in hifz and almost no app addresses it.

---

## 5. Feature catalogue

### 📖 Reading & Mushaf
- Pixel-accurate **Madani mushaf layout** (604 pages, 15 lines, correct line breaks) via QCF page fonts
- Tajweed color-coding (toggle) · adjustable Arabic size · night / sepia / parchment themes
- Translations side-by-side or beneath: **Uzbek, English, Russian, Arabic** (more later)
- Word-by-word meaning & root on tap · transliteration for beginners
- Tafsir panel (short + detailed)
- Bookmarks, notes, highlights, per-page journal

### 🎧 Audio
- Multiple reciters · **word-level highlight synced to audio** (karaoke)
- **A-B loop repeat** with configurable repetition count — the single most-used hifz tool
- Adjustable speed without pitch shift · gap/silence mode for shadowing
- Background playback + lock-screen controls (Android)
- **Record yourself**, play back against the reciter, save to your page history

### 🧠 Practice & drills (active recall, six modes)
1. **Progressive hide** — text fades word-by-word, then line-by-line, until blank
2. **First-word prompt** — only the opening word of each ayah is shown
3. **What comes next?** — hear/see an ayah, produce the next one
4. **Ayah shuffle** — reorder scrambled ayahs of a page
5. **Fill the gap** — random words removed
6. **Mutashabihat duel** — two near-identical passages side by side, identify which is which

### ✅ Testing & verification
- End-of-page, end-of-juz, and random-page tests with a score
- **Teacher verification**: submit a recording → teacher marks pass / repeat with per-ayah mistake pins and a voice note back
- Self-assessment honesty prompt (you can lie to an app, not to Allah — the copy says so, once, gently)

### 📊 Progress & insight
- Mushaf Mosaic · juz rings · strength heatmap calendar
- Pace pressure gauge · forecast khatm date · "days banked / days owed"
- Time-on-task, lines/hour, best time of day for *you*
- Weekly & monthly report cards (emailed, and shareable as an image)
- Full history export (JSON / CSV / printable PDF certificate on completion)

### 👥 Social & accountability
- **Halaqah** — private circles with an invite code; shared board, group progress, gentle leaderboard (opt-in, effort-based not shame-based)
- **Roles**: student · teacher · parent-observer
- Accountability partner: one person sees your daily green/red
- Group khatm challenges (e.g. "our circle finishes juz 30 together by Ramadan")

### 🔔 Habit & motivation
- Smart reminders at your declared study time; escalating nudge if the day is still empty by evening
- Streaks with rukhsah protection · milestone badges tied to *real* achievements only
- Your niyyah text resurfaced on missed days
- Ramadan mode: intensified plan + khatm tracker
- Daily ayah + a short reflection

### 🔐 Accounts & security
- **Every user has an account.** Sign-up is **email + password**, with the **email typed twice** and the **password typed twice**, followed by a **verification link** sent to that address. The app stays locked until the email is verified.
- Argon2id password hashing · rate-limited login · temporary lockout after repeated failures · secure httpOnly session cookies
- Password reset by signed, single-use, expiring link · changing your email re-verifies both the old and the new address
- Optional TOTP two-factor (Phase 3) · optional Google / Apple sign-in **in addition to**, never instead of, email + password
- Active-sessions list with "sign out everywhere" · account deletion that genuinely deletes · one-click data export

### 🌐 The whole surface (sitemap)

**Public — no account needed**

`/` landing: the promise, the covenant mechanic, a live demo of the mosaic · `/how-it-works` · `/features` · `/quran` public mushaf reader · `/about` · `/faq` · `/contact` · `/blog` hifz guidance articles · `/privacy` · `/terms`

**Auth**

`/signup` · `/verify-email` · `/login` · `/forgot-password` · `/reset-password`

**App — account required**

`/app` today's dashboard (sabaq / sabqi / manzil) · `/app/plan` the covenant, pace gauge, amendment history · `/app/plan/new` wizard · `/app/mushaf/[page]` reader · `/app/mosaic` the 604-page grid · `/app/practice` six drill modes · `/app/tests` · `/app/progress` charts and report cards · `/app/weak-spots` · `/app/recordings` · `/app/halaqah` circles · `/app/settings` profile, language, reciter, fonts, reminders, security, export

**Teacher / parent**

`/app/halaqah/[id]/students` · `/app/review-queue` submitted recitations

**Admin**

`/admin` users, reported text errors, content versions, metrics

### 🛡 Admin dashboard (`/admin`)
- **Live metrics** — signups, DAU/WAU/MAU, D1/D7/D30 retention, plan adherence, revision ratio, mean page strength across the whole user base
- **Users** — search, open any account, see its plan, amendment history, strength distribution and active sessions; suspend or delete with a full audit trail
- **Plans** — distribution of chosen durations and scopes, how many are at risk, how many completed, how many abandoned and when they broke
- **Content** — reported text-error queue, translation and audio versions, Qur'an checksum status per release
- **Community** — halaqah oversight, abuse reports, teacher verification backlog
- **Health** — email deliverability, background job status, error rates
- Read-only by default. Every destructive action needs a second confirmation and is written to an admin audit log.

### ⚙️ Platform
- **Responsive from 320px to ultrawide** — one design that is genuinely good on phone, tablet, laptop and desktop. Phone is the primary target; the mushaf reader gets a purpose-built full-bleed layout at every size, never a squeezed desktop page.
- **Full offline mode** — read, drill and mark progress with no connection; syncs when you are back
- Installable PWA · **Android app (Phase 4)** · **iOS app (Phase 5)** — all from one Capacitor codebase
- **Trilingual at launch: Uzbek (default), English, Russian.** Arabic UI with full RTL follows in Phase 2. Language is offered on first visit and switchable from anywhere.
- Dark mode by default, plus light and sepia · keyboard shortcuts on desktop
- Free, no ads, no paywall on core hifz features. Your data is yours and exportable.

---

## 6. Design language

> Calm, reverent, and precise. This is a place of worship, not a game arcade.

**Mood:** the quiet of a masjid before Fajr. Deep, warm, unhurried. Motion is slow and soft; nothing bounces or celebrates loudly.

| Token | Value | Use |
|---|---|---|
| Ink | `#0B1210` | Dark base |
| Emerald | `#0E5C4A` → `#1B8A6B` | Primary, progress |
| Gold | `#C9A227` | Accent, milestones, ayah markers |
| Parchment | `#F7F1E3` | Light base |
| Clay | `#B4553C` | Warnings / at-risk |

- **Type:** *KFGQPC Uthmanic Hafs* / QCF v2 for Qur'an · a warm serif for headings · Inter/Geist for UI
- **Motif:** subtle girih & khatam geometry as texture — 3–5% opacity, never decoration for its own sake
- **Dark mode is the default.** People memorize at Fajr and after Isha.
- **Accessibility:** WCAG 2.2 AA, 48px tap targets, full keyboard nav, screen-reader labelled Arabic, generous font scaling (hifz users zoom *a lot*)
- **Responsive:** designed mobile-first at 320px, then 640 / 768 / 1024 / 1280 / 1536. Every screen is drawn twice — once for a phone held one-handed at Fajr, once for a desktop — and the mushaf reader is a distinct layout per class
- **Never:** confetti on completing a juz, streak-guilt popups, dark patterns, ads near the mushaf

---

## 7. Technical architecture

### 7.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | First-class Vercel deploy, RSC, one codebase for web + Capacitor shell |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Fast, consistent, fully themeable, no runtime cost |
| Animation | **Framer Motion** | Restrained, physics-based transitions |
| Database | **Neon serverless Postgres** | Relational fits the plan/review model, scales to zero, branches per preview deploy |
| ORM | **Drizzle** | Typed schema, SQL-first, easy migrations, edge-compatible |
| Auth | **Custom sessions** — opaque token in an httpOnly cookie, backed by a `sessions` table, **Argon2id** hashing, mandatory email verification (**Resend** for mail) | Email + password is a hard requirement, and DB-backed sessions are what make the "sign out everywhere" list and instant revocation actually possible. Google / Apple can be added alongside later, never instead |
| Files | **Vercel Blob** | Recitation recordings |
| Server data | **Server Actions + TanStack Query** | Optimistic marking, offline queue replay |
| Offline | **Serwist SW + Dexie (IndexedDB)** | Full offline read, drill and progress marking |
| Charts | **Recharts / visx** | Strength curves, heatmaps |
| i18n | **next-intl** | uz / en / ru / ar with RTL |
| Notifications | Web Push + Capacitor Local Notifications | Reliable daily reminders on Android |
| Tests | **Vitest** (unit) + **Playwright** (e2e) | The plan-lock rules get an exhaustive test suite |
| Analytics | Vercel Analytics + PostHog | Privacy-respecting, no third-party ad SDKs |

### 7.2 Repository layout

```
ahd/
├─ src/
│  ├─ app/
│  │  └─ [locale]/          # every route is locale-scoped (uz | en | ru)
│  ├─ components/
│  │  ├─ ui/                # design-system primitives
│  │  ├─ brand/             # the mark and wordmark
│  │  ├─ site/              # header, footer, language & theme switchers
│  │  └─ landing/           # the public marketing page
│  ├─ core/                 # ⭐ pure TS domain logic, zero framework deps
│  │  ├─ plan/              #    generation, redistribution, pace, one-way lock
│  │  ├─ srs/               #    strength, decay, scheduling
│  │  └─ quran/             #    page/line/juz/hizb maths, ayah keys
│  ├─ db/                   # Drizzle schema, migrations, queries
│  ├─ auth/                 # sessions, hashing, verification, rate limits
│  ├─ i18n/                 # routing, request config, navigation helpers
│  └─ lib/                  # shared utilities
├─ messages/                # uz.json · en.json · ru.json
├─ data/                    # generated Qur'an index (pages, lines, ayahs, words)
├─ scripts/                 # content pipeline, seeding, font fetching
└─ mobile/                  # Capacitor shell (Phase 4)
```

> `src/core` is deliberately framework-free. The plan lock, redistribution maths
> and SRS are the heart of the product — they must be testable in isolation and
> reusable by any future client.
>
> A single Next.js app rather than a monorepo: it deploys to Vercel with zero
> configuration, and module boundaries inside `src/` give the same separation
> without the workspace tooling.


### 7.3 Offline and sync

- Everything the user can *see* is cached: mushaf pages, translations, their own plan and progress
- Audio is opt-in per-juz download — bandwidth matters, many users are on limited mobile data
- Writes go to a **local outbox**, replayed on reconnect
- Conflict policy: **progress is monotonic** (a page marked memorized offline never regresses on sync); plan mutations are server-authoritative and re-validated against the one-way rule on arrival

---

## 8. Data model

```
users ──┬── (email, email_verified_at, password_hash, role,
        │    failed_logins, locked_until, created_at)
        ├── email_verifications  token, expires_at, consumed_at
        ├── password_resets      token, expires_at, consumed_at
        ├── sessions             device, ip, user_agent, last_seen
        ├── profiles           locale (uz|en|ru), reciter, font size,
        │                      timezone, study time
        │
        ├── plans              scope, start, original_end, current_end,
        │     │                daily_unit, daily_amount, rukhsah_budget/used,
        │     │                status (active|completed|abandoned), niyyah
        │     │
        │     ├── plan_amendments      APPEND-ONLY: old_end, new_end, kind, reason
        │     │                        CHECK (new_end <= old_end)
        │     └── plan_days            date, sabaq[], sabqi[], manzil[], status
        │
        ├── memorization_units  one row per page (or ayah) per user:
        │     │                 state, strength 0-100, ease, lapses,
        │     │                 last_reviewed, next_due
        │     ├── review_logs    type (sabaq|sabqi|manzil|test), quality,
        │     │                  mistakes, duration, at
        │     ├── mistakes       ayah_key, word_index, kind, linked_ayah_key, note
        │     └── recordings     storage_path, duration, teacher_verdict, notes
        │
        ├── halaqah_members ── halaqahs ── halaqah_posts
        ├── streaks
        └── achievements

static content (seeded, shared):
  quran_surahs / quran_ayahs / quran_pages / quran_lines / quran_words
  translations / reciters / audio_timings / mutashabihat_pairs
```

**Non-negotiable invariants, enforced at the database level:**

1. `plans.current_end_date <= plans.original_end_date` — always
2. Any `UPDATE` that moves the deadline **must** write a `plan_amendments` row (trigger)
3. `rukhsah_used <= rukhsah_budget`
4. Scope reduction allowed **at most once** per plan
5. `memorization_units.strength` never increases without a corresponding `review_logs` row

---

## 9. Quran content pipeline and licensing

Getting the text right is a religious responsibility, not a technical detail.

| Asset | Source | Licence |
|---|---|---|
| Uthmani text + page/line/juz/hizb metadata | **Quran Foundation (QUL)** and Tanzil.net | Open, verified against the King Fahd Complex mushaf |
| Mushaf fonts | **QCF v2** (604 per-page fonts) + KFGQPC Uthmanic Hafs | Free for use, ~8 MB total, lazy-loaded per page |
| Audio | EveryAyah / Quran.com reciters with ayah and word timings | Per-reciter terms recorded in `data/LICENSES.md` |
| Translations | Only openly-licensed ones (Sahih International, vetted uz/ru) | Attribution shown in-app next to every translation |

**Rules we hold ourselves to:**

- Arabic text is **byte-verified against a reference checksum** at build time and in CI. A corrupted ayah is a release blocker, not a bug ticket.
- Every translation and tafsir displays its translator and licence in the UI.
- No AI-generated Quranic text, translation or tafsir. Ever.
- A visible "report a text error" button on every page, routed to a maintainer.

---

## 10. Roadmap and phases

Rough effort assuming steady part-time work. Each phase ends deployed and usable.

### Phase 0 — Foundation `~1 week`

Monorepo scaffold, design system and tokens, Quran data pipeline producing the 604-page index, DB schema and migrations, auth foundation (Auth.js credentials + Argon2id + Resend verification mail), trilingual i18n scaffolding (uz / en / ru), CI (typecheck, lint, test, verified-text check).

### Phase 1 — MVP: The Covenant `~3 weeks` → **first Vercel deploy**

Landing page and the public marketing pages, full email + password sign-up with double-entry and mandatory email verification, plan wizard with niyyah and lock, plan generation engine, **one-way deadline rule with a full test suite**, daily dashboard (sabaq / sabqi / manzil), mushaf reader with QCF pages, mark-as-done, Mushaf Mosaic, streaks, pace pressure, redistribution.

> At the end of Phase 1 a real person can commit to 30 juz in 3 years and use it every day.

### Phase 2 — Practice and Memory `~3 weeks`

SRS strength and decay engine, all six drill modes, audio player with A-B loop and word highlighting, self-recording, mistake tagging, weak-spot list, page and juz tests, translations and word-by-word.

### Phase 3 — Together `~2-3 weeks`

Halaqah circles, teacher and parent roles, recitation submission and verification, group boards, notifications, weekly report cards, shareable progress image.

### Phase 4 — Offline and Android `~2-3 weeks` → **Play Store**

Serwist service worker, Dexie local store, sync outbox and conflict rules, per-juz audio download, Capacitor shell, local notifications, background audio, Play Console listing, policy and data-safety forms.

### Phase 5 — Depth and iOS `ongoing`

Mutashabihat engine and drills, tajweed colouring, tafsir, Ramadan mode, vocabulary and roots, **iOS app** via the same Capacitor codebase, printable certificate, and **R&D: on-device recitation checking** — flagged as research only. Accuracy on Quranic Arabic must be proven before it is ever shipped anywhere near hifz feedback.

---

## 11. Deployment: Vercel then Play Store

### Web (Phase 1 onward)

- Vercel CLI is already installed: `vercel link` then `vercel --prod`
- `main` branch to production, PRs get preview deploys
- Neon or Supabase Postgres, env vars in Vercel, custom domain later

### Android (Phase 4) — recommendation: **Capacitor, not TWA**

| | TWA (Bubblewrap) | **Capacitor** |
|---|---|---|
| Effort | Lowest | Low to medium |
| Reliable daily notifications | weak | **native local notifications** |
| Background audio, lock-screen controls | no | **yes** |
| Offline audio file storage | limited | **native filesystem** |
| Play Store review risk | can be flagged as "just a website" | lower |

Scheduled reminders and background recitation audio are core to this product, so **Capacitor wins**. It still wraps the same Next.js build — one codebase, not two.

Play Store checklist: signed AAB, adaptive icon and feature graphic, privacy policy URL, Data Safety form, content rating, **no in-app purchases and no ads**, staged rollout.

---

## 12. Success metrics

We are not optimising for time-in-app. We are optimising for **hifz that survives**.

| Metric | Target |
|---|---|
| **D30 plan adherence** — committed days completed after 30 days | > 70% |
| **D180 retention** — users still active after 6 months | > 35% |
| **Revision ratio** — revision minutes / new-memorization minutes | >= 2.0 |
| **Mean page strength** across a user's memorized pages | > 75 |
| **Deadline extensions granted** | **0. Always 0.** |
| Users who complete a full juz | the number that actually matters |

---

## 13. Decisions locked (and what is still open)

**Locked by the owner — build to these:**

| # | Decision | Ruling |
|---|---|---|
| 1 | Product name | **Ahd** |
| 2 | Relief valve when badly behind | **Scope reduction allowed once**, permanently recorded in plan history. The deadline still never moves. |
| 3 | Rukhsah budget | Default **12 days/year**, settable 0–24 at plan creation, fixed forever afterwards |
| 4 | Manzil cycle | **Adaptive** — weakest pages first — with the classic 1-juz-per-day rotation available as a toggle |
| 5 | Languages at launch | **Uzbek (default), English and Russian — all three from day one.** Arabic UI with RTL in Phase 2 |
| 6 | Accounts | **Required.** Email + password, email entered twice, password entered twice, verification link mandatory before the app unlocks |
| 7 | Platforms | Responsive web first → **Android (Phase 4)** → **iOS (Phase 5)**, one Capacitor codebase |
| 8 | Business model | **Free forever. No ads, no paid tier, no upsell hooks.** |
| 9 | Public reader | `/quran` is readable and listenable **without an account**. An account is required only for anything that saves progress. |
| 10 | Reciters | **Mishary Alafasy is the default**, with Alijon Qori (Uzbekistan), Badr al-Turki, Al-Husary and Al-Minshawi all available |
| 11 | Teacher verification | **Yes, Phase 3** — students submit recordings, teachers mark pass/repeat with per-ayah pins |
| 12 | Database | **Neon** serverless Postgres |
| 13 | Admin | A **full admin dashboard** at `/admin` — users, analytics, plans, content, community, health |

**Still open — tell me and I will fold it in:**

1. **Domain name** — do you already have one, or should I suggest options? (`ahd.uz`, `ahd.app`, `getahd.com`…)
2. **Support page** — a quiet "support this project" page, or nothing at all?
3. **Logo lockup** — the mark is currently the rub' al-hizb ۞, the eight-pointed star that marks divisions in the mushaf itself. Keep it, or explore alternatives?

---

## 14. Build log

What is actually built, as of the latest commit. Updated every time something lands.

### ✅ Phase 0 — Foundation *(in progress)*

| | Item | Notes |
|---|---|---|
| ✅ | Next.js 16 + React 19 + TypeScript + Tailwind v4 | Single app, `src/` layout, Turbopack builds |
| ✅ | Design system | Emerald / gold / ink / parchment token scales, three themes (dark, light, sepia) with no flash of the wrong one, girih texture, calm motion curves |
| ✅ | Typography | Inter (Latin + Cyrillic), Cormorant Garamond for display, Amiri for Qur'anic text — all self-hosted via `next/font` |
| ✅ | Trilingual i18n | `uz` (default, no URL prefix) · `en` · `ru`, with `dir` plumbing already in place for Arabic in Phase 2 |
| ✅ | Public marketing site | Landing page: hero with a live product preview, the hadith band, the problem, **the interactive covenant demo**, the three tracks, the 604-tile mushaf mosaic, six practice modes, the feature grid, final CTA |
| ✅ | Header / footer / language switcher / theme toggle | Responsive down to 320px, full mobile sheet, skip link, focus rings |
| ⬜ | Neon Postgres + Drizzle schema | Next |
| ⬜ | Auth: email + password, double entry, verification | Next |
| ⬜ | Qur'an data pipeline (604-page index) | |
| ⬜ | CI: typecheck, lint, test, verified-text check | |

**The covenant demo on the landing page is real, not a mockup.** Pulling the deadline earlier recalculates the daily line count and appends a row to a visible `plan_amendments` log. Pushing it later is refused, with the card physically recoiling. That is the product's thesis, playable before you sign up.

### ⬜ Phase 1 — MVP: The Covenant
### ⬜ Phase 2 — Practice and Memory
### ⬜ Phase 3 — Together
### ⬜ Phase 4 — Offline and Android
### ⬜ Phase 5 — Depth and iOS

---

## 15. Running it locally

```bash
npm install
cp .env.example .env.local     # fill in Neon, Resend and AUTH_SECRET
npm run dev                    # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle schema workflow |
| `npm run quran:build` | Regenerate the Qur'an page/line index |

---

<div align="center">

**رَبِّ زِدْنِي عِلْمًا**

*"My Lord, increase me in knowledge."* — Ta-Ha 20:114

</div>
