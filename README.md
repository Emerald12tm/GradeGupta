# ShauryaGrades

A Home Access Center (HAC) grade app: an **Expo** mobile app plus a **Next.js** website on **Vercel**, both sharing one **Supabase** backend so everything stays in sync.

```
apps/
  mobile/     Expo SDK 57 (Expo Router, React Query) — runs in Expo Go
  web/        Next.js 16 on Vercel — website + the API both apps call
    src/app/api/hac/link    verify HAC login, store encrypted password
    src/app/api/hac/sync    pull fresh grades from HAC
    src/app/api/cron/sync   nightly background sync (Grade Insights history)
    src/lib/hac/            HAC scraper (login + HTML parsing)
packages/
  core/       shared TypeScript: types, what-if / GPA / target-grade math,
              bell schedule, A/B days, planner time-blocking, themes (+ tests)
supabase/
  migrations/ database schema with row-level security
```

## How the pieces fit together

```
Expo app ──┐                         ┌── Supabase Postgres (RLS, realtime)
           ├─ Supabase auth + data ──┤
Website ───┘                         └── Storage (profile pictures)
     │
     └── /api/hac/* on Vercel ──► district HAC (scraped server-side)
```

- **Grade math runs on-device** from `@sg/core`, so what-if and GPA changes show up instantly and both apps give the same numbers.
- **HAC scraping happens only on the server**: browsers block cross-site requests to HAC, and one scraper is easier to maintain than two.
- **HAC passwords** are encrypted with AES-256-GCM using a key that exists only in Vercel. Clients can't read that column; the grants in the migration block it.
- **Realtime** is on for planner tasks, mock grades and activity logs, so edits appear on the phone and the website right away.

## First-time setup

### 1. Supabase
1. Create a project at supabase.com.
2. `npx supabase login`, then `npx supabase link --project-ref <your-ref>`.
3. `npx supabase db push` applies `supabase/migrations`.
4. Authentication → URL Configuration: add your Vercel URL and `shauryagrades://**` as redirect URLs.

For local development you can run Postgres in Docker with `npx supabase start` instead.

### 2. Vercel (website + API)
1. Import the repo in Vercel and set **Root Directory = `apps/web`**. Vercel detects the npm workspace.
2. Add every key from `apps/web/.env.example` under Environment Variables.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` for local dev.

### 3. Expo app
1. Copy `apps/mobile/.env.example` to `apps/mobile/.env.local`.
2. `npm run dev:mobile` and scan the QR code with Expo Go.
3. To test against your local API, set `EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:3000`.

## Commands (run from repo root)

| Command | What it does |
|---|---|
| `npm install` | install all workspaces (one shared `node_modules`) |
| `npm run dev:web` | website + API at http://localhost:3000 |
| `npm run dev:mobile` | Expo dev server (Expo Go) |
| `npm test` | grade/GPA/schedule math tests |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm run db:types` | regenerate Supabase types into `@sg/core` |

## Feature map

| Feature | Tier | Where it lives | Status |
|---|---|---|---|
| Persistent login | Free | `api/hac/link` + encrypted `student_accounts` | API ready |
| Grade dashboard, categories, missing work | Free | `HacSession.getCourses`, `missingAssignments` | parser ready, UI to build |
| Planner (HAC + personal tasks) | Free | `planner_tasks` | schema ready |
| Schedule, report cards, transcript, attendance | Free | `HacSession` TODOs | to build |
| Bell schedule timer + A/B days | Free | `bellStatus`, `rotationDay`, `bell_schedules` | logic + tests ready |
| Email teachers | Free | `Course.teacherEmail` (from Classes.aspx) | to build |
| Multiple student profiles | Free | `student_accounts` (many per user) | schema ready |
| What-if calculator | Premium | `whatIf`, `mock_grades` (premium-gated in RLS) | logic + tests ready |
| GPA calculator / predictor | Premium | `computeGpa`, editable `GpaScale` | logic + tests ready |
| Grade Insights (trends, new grades) | Premium | `grade_snapshots`, `course_averages`, nightly cron | pipeline ready |
| 10 themes, display names, avatars | Premium | `THEMES`, `profiles.theme_id`, `avatars` bucket | ready |
| Face ID / Touch ID lock | Premium | `apps/mobile/src/lib/biometrics.ts` | ready (needs dev build) |
| Target grade / final exam calculator | New | `requiredExamScore`, `requiredAssignmentScore` | logic + tests ready |
| Auto time-blocking (Pomodoro) | New | `timeBlock` | logic + tests ready |
| Extracurricular / robotics hours | New | `activities`, `activity_logs` | schema ready |

## Things to know

- **Validate the HAC parser against your district.** HAC layouts differ slightly between districts. Log in once through `/api/hac/link`, call `/api/hac/sync`, and if anything comes back empty, adjust the selectors in `apps/web/src/lib/hac/client.ts`.
- **Payments.** Apple and Google require in-app purchase for a digital subscription, so use RevenueCat on mobile and Stripe on the web. Both webhooks should set `profiles.premium_until`, which only the server can write.
- **Face ID doesn't work in Expo Go.** It falls back to the device passcode. Test biometrics with a development build (`npx eas build --profile development`).
- **Vercel Hobby crons run once a day.** That's enough for daily Insights history. With many users, move the nightly sync to a queue so it stays under the 300 s function limit.
