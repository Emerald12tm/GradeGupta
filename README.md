# GradeGupta

A grade app for **Home Access Center (HAC)**, built with Expo for iOS and Android. It covers everything you'd expect from a premium grade viewer (live averages, GPA, what-if grades, new-grade alerts), plus a final exam calculator that can work out what you got on the final, even when a teacher folds it into the average.

Your HAC password and grades **never leave your phone**. There's no server and no account. The app signs in to your district's HAC site directly, the same way your browser does.

> Not affiliated with PowerSchool, Home Access Center, or any school district.

---

## Features

**Grades**
- Every class with its live average, letter grade and assignment count; pull to refresh.
- Switch between marking periods.
- Class pages with category weights and averages, every assignment, missing/ungraded flags and a trend chart.
- "Average includes something hidden" warning when HAC's average doesn't match the visible assignments.

**GPA**
- Weighted and unweighted GPA from current averages.
- Built-in scales: 4.0 letter, linear 5.0 and linear 6.0. Set each class's level (Regular / Honors / AP / DC), its credits, or leave it out of GPA.
- Transcript view with HAC's official GPA and rank, plus a GPA recalculated with your scale.

**Calculators**
- **What-if mode:** change scores, drop assignments and add made-up ones; see the new average instantly.
- **What do I need?** The score needed on the next assignment in any category to reach a target.
- **Final exam calculator:**
  - *Before the final:* the exam score you need for an A, B, C or any target.
  - *After the final:* the exam score you got, worked backward from the posted semester grade.
  - *Hidden grade:* when a teacher puts the final (or any test) into the class or semester average before posting it, this solves for that score.
  - Can be filled in from your HAC report card. Supports 42.5/42.5/15, 40/40/20, 45/45/10, six-weeks formulas and custom weights.
  - Accounts for HAC rounding: shows a range when one exact number isn't possible.

**Alerts**
- Background checks for new and changed grades, with local notifications.
- Optional alerts when a class average moves by N points, or drops below a threshold you pick.

**Planner and school info**
- Missing work and upcoming assignments across all classes.
- Your own to-dos with reminders.
- Schedule (tap to email teachers), report card, progress report, attendance.

**Insights**
- GPA over time, biggest changes this week, how close each class is to the next letter, and which category is costing you the most points.

**Privacy**
- Optional Face ID / fingerprint lock.
- Password stored in the iOS Keychain / Android Keystore.
- Grade history stored only in a local database.

## Getting started

You'll need **Node 20+** and either **Android Studio** (Android emulator or device) or **Xcode on a Mac** (iOS). The app uses native modules (secure storage, background tasks, SQLite), so it runs as a [development build](https://docs.expo.dev/develop/development-builds/introduction/), not in Expo Go.

```bash
npm install
npm run android      # builds and installs a dev build on an emulator/device
npm run ios          # macOS only
npm start            # after the first build: start the JS server and reload
```

No Mac? You can build iOS in the cloud with EAS: `npx eas-cli@latest build --profile development --platform ios`.

Sign in with your district's HAC address (the site you normally open, e.g. `hac.yourdistrict.org`) and your HAC username and password.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests (grade math, HAC parsers, HAC client, change detection) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (Expo config) |
| `npm run check` | All three |

## Project layout

```
src/
  app/            Screens (Expo Router: every file is a route)
    (tabs)/       Grades, Planner, Insights, More
    class/[id]    Class detail, what-if, "what do I need"
    calculator    Final exam / semester / hidden-grade calculator
  hac/            HAC client (login, session) and one parser per HAC page
  grades/         Pure grade math: averages, what-if, GPA, semester, solver
  sync/           Scrape → diff → save → notify; local notifications
  background/     Background grade check
  storage/        Secure credential storage and the local SQLite database
  settings/       User settings (GPA scale, semester formula, alerts…)
  data/           Sign-in state and React Query hooks used by screens
  components/     Shared UI
docs/             Architecture, grade math and HAC scraping notes
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how data flows from HAC to the screen, storage, the background task.
- [Grade math](docs/GRADE-MATH.md): every formula, with worked examples, including the final exam and hidden-grade solvers.
- [HAC scraping](docs/HAC-SCRAPING.md): which pages are read, how parsing works, and how to fix it for a district whose HAC looks different.

## Known limitations

- **Alert timing.** iOS and Android decide when background checks run: usually every 30 minutes to a few hours, less often on low battery. Instant alerts would need a server holding your password, which this app deliberately avoids.
- **Background tasks don't run in the iOS Simulator.** Test them on a real device.
- **Districts differ.** Parsers are tested against synthetic pages that copy HAC's markup. If something looks wrong for your district, see [HAC scraping](docs/HAC-SCRAPING.md#when-your-district-looks-different).
- **Attendance** shows the month HAC opens on (usually the current one).
- **Not built yet:** home-screen widgets.

## License

MIT. See [LICENSE](LICENSE).
