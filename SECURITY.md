# Security

GradeGupta handles students' school login credentials, so security reports are taken seriously.

## Reporting a vulnerability

**Please don't open a public issue for security problems.** Use GitHub's private reporting instead: [Report a vulnerability](https://github.com/Emerald12tm/GradeGupta/security/advisories/new). Include steps to reproduce if you can. We aim to respond within a week.

## How the app protects data

| Area | What it does |
|---|---|
| Credentials | Stored only in the iOS Keychain / Android Keystore (`expo-secure-store`). Never logged, never sent anywhere except the district's HAC host. |
| Network | HTTPS only: `http://` addresses are upgraded. Responses that redirect to a different host or to plain HTTP are rejected. |
| Sessions | Every sign-in first signs out any existing HAC session, so saved accounts can't see each other's sessions in the shared cookie store. |
| Stored grades | Kept in a local SQLite database per account, deleted when the account is removed. Excluded from Android cloud backup (`allowBackup: false`). |
| Privacy | Optional Face ID / fingerprint lock. When the lock is on, the app shows a privacy cover in the app switcher. |
| Third parties | No backend, analytics, ads or crash reporting SDKs. |
| Unverified districts | Typed-in HAC addresses get a warning before signing in, to reduce the risk of entering a password on a look-alike site. |

## Dependencies

`npm audit` reports advisories in Expo / React Native **build tooling** (Metro, Jest, glob matching, code-signing helpers). They are pinned by the Expo SDK, and most run only on the developer's machine at build time, not in the app on a phone. They're resolved by upgrading the Expo SDK when a fixed release is available. Avoid `npm audit fix --force`, which installs versions incompatible with the SDK.
