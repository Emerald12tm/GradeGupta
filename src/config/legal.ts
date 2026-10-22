/**
 * Legal text shown in the app (About & legal screen, sign-in agreement).
 *
 * docs/PRIVACY.md and docs/TERMS.md contain the same text for the GitHub repo and app
 * store listings; update both together and bump `LEGAL_VERSION` when either changes.
 *
 * This text was written to describe what the app actually does. It is not legal advice:
 * have a lawyer review it before publishing the app to a store.
 */

export const LEGAL_VERSION = '2026-10-21';
export const CONTACT_URL = 'https://github.com/Emerald12tm/GradeGupta/issues';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

/** Short disclaimer used on the sign-in screen and at the top of About & legal. */
export const DISCLAIMER =
  'GradeGupta is an independent app. It is not affiliated with, endorsed by, or sponsored by PowerSchool, Home Access Center, or any school district. Home Access Center is a trademark of its owner. Grades and calculations shown here are unofficial estimates; your school’s records are the official ones.';

export const PRIVACY_POLICY: LegalSection[] = [
  {
    title: 'The short version',
    paragraphs: [
      'GradeGupta has no servers, no accounts with us, no ads, no analytics and no tracking. Your HAC login and your grades stay on your phone. We (the developers) never receive them.',
    ],
  },
  {
    title: 'What is stored on your phone',
    paragraphs: [
      'Your district’s HAC address, your HAC username and password, stored in your phone’s secure keychain (iOS Keychain or Android Keystore).',
      'Copies of your grades, grade history, planner to-dos and app settings, stored in a local database on your phone.',
    ],
  },
  {
    title: 'Where your data goes',
    paragraphs: [
      'Only to your school district’s Home Access Center website, over an encrypted HTTPS connection, to sign in and load your pages, the same as when you use HAC in a browser. Nothing is sent to us or to any third party.',
      'Grade alerts are created on your phone. They are not sent through a push notification server.',
    ],
  },
  {
    title: 'Deleting your data',
    paragraphs: [
      'Removing an account in Settings deletes its saved password and all of its saved grades from your phone. Deleting the app deletes everything.',
    ],
  },
  {
    title: 'Students and children',
    paragraphs: [
      'GradeGupta is meant for students and their parents or guardians. Because no personal information is sent to us, we do not collect information from children. Students under 13 should use the app with a parent’s or guardian’s permission.',
      'Your education records travel directly from your district to your own device. We never receive, store or share them.',
    ],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      `If this policy changes, the new version will appear in the app and on GitHub. Questions: ${CONTACT_URL}`,
    ],
  },
];

export const TERMS_OF_USE: LegalSection[] = [
  {
    title: 'Unofficial app',
    paragraphs: [DISCLAIMER],
  },
  {
    title: 'Use your own account',
    paragraphs: [
      'Only sign in with a Home Access Center account you are allowed to use: your own, or your child’s as their parent or guardian. Follow your school district’s acceptable-use rules for HAC. Don’t use the app to access anyone else’s records without permission.',
      'GradeGupta checks HAC no more often than your phone allows background apps to run, and when you refresh. Please don’t use it in a way that overloads your district’s website.',
    ],
  },
  {
    title: 'Estimates, not official grades',
    paragraphs: [
      'Averages, GPA, what-if results, final exam calculations and “hidden grade” estimates are calculated by the app and may be wrong, for example if your district uses a different formula or HAC changes. Always confirm important grades with your teacher or school. Don’t make decisions (such as skipping an exam) based only on this app.',
    ],
  },
  {
    title: 'No warranty',
    paragraphs: [
      'GradeGupta is free, open-source software provided “as is”, without warranty of any kind. It may stop working if HAC or your district’s website changes. To the fullest extent allowed by law, the developers are not liable for any damages arising from using the app, including incorrect grades, missed notifications, or loss of data.',
    ],
  },
  {
    title: 'Open source',
    paragraphs: ['The source code is available under the MIT License at https://github.com/Emerald12tm/GradeGupta.'],
  },
  {
    title: 'Changes',
    paragraphs: ['These terms may be updated. Continuing to use the app after an update means you accept the new terms.'],
  },
];
