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

**Planning**
- **GPA planner:** type the grade you expect in each class and see your projected GPA.
- **Final exam planner:** the score needed on every final for an A, B or C, all on one screen. It uses the report card plus live averages for the unposted grading period.
- **Goals:** set a target per class. You see how far you are from it, the score you need next, and you get an alert if a class slips below it.
- **Tips:** study tips from your own numbers, such as missing work worth turning in, the category costing you the most, and how much the next test can swing your grade.
- **Compare marking periods:** each class's average across marking periods, side by side.

**Sharing and staying on top**
- **Share grades:** a designed GPA image, or a full PDF grade report, through the share sheet.
- **Calendar sync:** upcoming HAC due dates go into a "GradeGupta" calendar on your phone.
- **Email teacher:** one tap from a class or a missing assignment, with a pre-filled subject.
- **Weekly digest:** a Sunday-evening notification with grade changes, missing work and what's due.
- **Backup and restore:** save your grade history to a file to keep your trends on a new phone. Passwords are never included.
- **Attendance stats:** counts of tardies and absences.
- **Text size:** Default, Large or Larger, on top of your phone's own setting.
- **Demo mode:** try the app with sample grades, no HAC login needed.

**Accounts and themes**
- Pick your district from a searchable list (or type any HAC address).
- Save several HAC accounts (siblings, or more than one district) and switch from the More tab. Each keeps its own grades, history and planner, and background alerts cover all of them.
- 11 color themes (Classic, Green, Ocean, Sunset, Amethyst, Ruby, Lemon, Magenta, Marine, Midnight, Terracotta) with System / Light / Dark appearance.

**Privacy**
- Optional Face ID / fingerprint lock.
- Password stored in the iOS Keychain / Android Keystore.
- Grade history stored only in a local database.

## Getting started

You'll need **Node 20+**. The project is on **Expo SDK 57**.

**Quickest: Expo Go.** Install Expo Go (SDK 57) on your phone, then:

```bash
npm install
npm start            # scan the QR code, or enter exp://<your-PC-IP>:8081 in Expo Go
```

Your phone and computer must be on the same Wi-Fi. In Expo Go, background grade checks don't run (alerts only arrive while the app is open).

**Full build** (background alerts, Face ID): needs Android Studio, or Xcode on a Mac.

```bash
npm run android      # builds and installs a development build
npm run ios          # macOS only
```

No Mac? Build iOS in the cloud with EAS: `npx eas-cli@latest build --profile development --platform ios`.

Pick your district (or choose "My district isn't listed" and type your HAC address) and sign in with your HAC username and password.

**Using it away from home**

| Option | Needs this computer on? | Cost | Background alerts |
|---|---|---|---|
| `npm run start:anywhere`: Expo Go over an internet tunnel | Yes | Free | No |
| `npm run build:android`: installable Android app (`.apk`) | No | Free EAS tier | Yes |
| `npm run build:ios`: iPhone install via EAS + TestFlight / ad hoc | No | Apple Developer Program ($99/yr) | Yes |

**Builds:** the first time, run `npx eas-cli@latest login` (free Expo account). Then run `npm run build:android`. When the cloud build finishes, EAS prints a link and QR code. Open it on your Android phone, download the `.apk` and install it. Android will ask you to allow installing apps from your browser.

For iPhone, join the Apple Developer Program, then run `npm run build:ios`. EAS walks you through registering your iPhone.

**Web preview:** `npm start`, then press `w`. The screens render, but signing in doesn't work in a browser: browsers block requests to another site (your district's HAC).

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
- **Not built yet:** home-screen widgets (they need native code, so they won't run in Expo Go), Spanish translation, encrypted backup files, and attendance for months other than the one HAC opens on.

## Privacy, terms and security

- [Privacy Policy](docs/PRIVACY.md): no servers, no tracking; data stays on the phone.
- [Terms of Use](docs/TERMS.md): unofficial app, estimates only, use your own account, no warranty.
- [Security](SECURITY.md): how credentials and data are protected, and how to report a vulnerability.

The same policies are in the app under More → About & legal, and users agree to them when they sign in. They describe what the app does but were not written by a lawyer; get them reviewed before publishing to an app store.

## License

MIT. See [LICENSE](LICENSE).
