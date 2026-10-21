# Architecture

GradeGupta is a single Expo app with no backend. Everything (signing in to HAC, parsing pages, grade math, history, notifications) happens on the phone.

```
┌──────────────────────── phone ────────────────────────┐
│                                                        │
│  Screens (src/app)                                     │
│     │  React Query hooks (src/data/queries.ts)         │
│     ▼                                                  │
│  syncGrades (src/sync/sync.ts) ◄── background task     │
│     │        │         │           (src/background)    │
│     │        │         └─► notifications (local)       │
│     │        └─► SQLite: snapshots, history, to-dos    │
│     ▼                                                  │
│  HacClient (src/hac/client.ts)                         │
│     │  login · session cookies · re-login on expiry    │
│     ▼                                                  │
│  Parsers (src/hac/parsers) ─► plain data (types.ts)    │
│                                                        │
│  Grade math (src/grades): pure functions, no I/O       │
└────────────────────────┬───────────────────────────────┘
                         │ HTTPS
                         ▼
              district HAC site (hac.yourdistrict.org)
```

## Layers

| Layer | Folder | Rule |
|---|---|---|
| Screens | `src/app` | Render data from hooks. No HAC or SQL calls directly. |
| Data hooks | `src/data` | The only place screens get data from. Wraps React Query. |
| Sync | `src/sync` | Scrape, diff, save and notify, shared by the UI and the background task. |
| HAC | `src/hac` | Network and HTML. Parsers are pure `html → data` functions. |
| Grade math | `src/grades` | Pure TypeScript. No React, no I/O. Fully unit tested. |
| Storage | `src/storage` | Secure store (credentials) and SQLite (everything else). |

Keeping the math and parsers pure is what makes them testable without a phone or a real HAC account. `npm test` exercises them directly.

## Signing in

1. The login screen calls `useSession().signIn(credentials)` (`src/data/session.ts`).
2. `HacClient.login()` GETs the HAC login page, copies its form fields (anti-forgery token, district database), adds the username and password, and POSTs it back.
3. If HAC answers with the login form again, the credentials are wrong. HAC's own error message is shown.
4. On success, credentials are saved with `expo-secure-store` (Keychain / Keystore, `AFTER_FIRST_UNLOCK` so background checks can read them), and the root layout's `Stack.Protected` guard switches to the app.

Session cookies are kept by the OS cookie store that React Native's `fetch` uses. If a later request lands on the login page (the session expired), `HacClient` logs in again once and retries.

## A sync

`syncGrades(client, { markingPeriod?, notify? })`:

1. Fetch `Assignments.aspx` (with a WebForms postback to switch marking period, if asked).
2. Parse it into `Course[]` and apply the user's per-class overrides (level, credits).
3. Load the previous snapshot for that marking period and diff it (`src/sync/diff.ts`) to find new grades, changed grades and average changes.
4. Save the new snapshot. For the current marking period, also append course and GPA history rows (only when values changed).
5. If `notify`, filter changes by the user's alert settings and post local notifications.

Pull-to-refresh calls this through `useGrades()`. The background task calls it with `notify: true`.

If HAC can't be reached, `useGrades()` falls back to the last saved snapshot and marks the data `offline` so the UI can say so.

## Background checks

`src/background/task.ts` defines a task with `expo-task-manager` and registers it with `expo-background-task` (minimum interval 30 minutes). The OS decides the real schedule. The task loads settings and credentials, runs a sync with notifications on, and exits.

To test in a debug build: Settings → "Run background check now (dev)". On iOS this only works on a physical device.

## Storage

**Secure store:** `hac.credentials.v1`: `{ baseUrl, username, password }`.

**SQLite** (`gradegupta.db`, schema in `src/storage/db.ts`):

| Table | Contents |
|---|---|
| `kv` | Settings JSON |
| `snapshots` | Latest `Course[]` per marking period (also under `current`), used for diffing and offline viewing |
| `course_history` | `(course_id, taken_at, average)`, appended when an average changes |
| `gpa_history` | `(taken_at, weighted, unweighted)`, appended when GPA changes |
| `todos` | Planner items plus scheduled reminder ids |

Timestamps are ISO-8601. Signing out deletes the credentials and clears every table.

Schema changes: bump `SCHEMA_VERSION` and add the migration step in `migrate()`.

## Navigation

Expo Router, file-based. `src/app/_layout.tsx` is a stack with two `Stack.Protected` groups:

- signed in: `(tabs)` (Grades, Planner, Insights, More), `class/[id]`, `calculator`, `schedule`, `report-card`, `progress`, `transcript`, `attendance`, `settings`
- signed out: `login`

The tab bar (`src/components/app-tabs.tsx`) uses native tabs with SF Symbols on iOS and Material icons on Android.

## Settings

`src/settings/settings.ts` holds one JSON object in `kv`. React screens read it with `useSettings()` (Zustand). The background task reads it with `loadSettings()`. New fields get defaults from `DEFAULT_SETTINGS`, so older installs keep working.
