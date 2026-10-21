# HAC scraping

Home Access Center has no public API. GradeGupta signs in like a browser and reads the HTML pages. This page explains which pages are used, how parsing works, and how to fix things for a district whose HAC looks different.

## Pages

All paths are relative to the district host (e.g. `https://hac.yourdistrict.org`), see `src/hac/endpoints.ts`.

| Page | Path | Parser | Used for |
|---|---|---|---|
| Login | `/HomeAccess/Account/LogOn` | `parsers/forms.ts` | Signing in |
| Assignments | `/HomeAccess/Content/Student/Assignments.aspx` | `parsers/assignments.ts` | Classes, averages, categories, assignments, marking periods |
| Schedule | `/HomeAccess/Content/Student/Classes.aspx` | `parseSchedule` | Schedule, teacher emails |
| Report card | `/HomeAccess/Content/Student/ReportCards.aspx` | `parseReportCard` | Report card, calculator pre-fill |
| Progress | `/HomeAccess/Content/Student/InterimProgress.aspx` | `parseProgressReport` | Progress report |
| Transcript | `/HomeAccess/Content/Student/Transcript.aspx` | `parseTranscript` | Past grades, GPA, rank |
| Attendance | `/HomeAccess/Content/Attendance/MonthlyView.aspx` | `parseAttendance` | Attendance |
| Registration | `/HomeAccess/Content/Student/Registration.aspx` | `parseStudentInfo` | Name, grade, campus |

## How parsing works

HAC is an ASP.NET WebForms site, and its markup is very regular:

- Grids are `<table class="sg-asp-table">` with a `tr.sg-asp-table-header-row` and `tr.sg-asp-table-data-row`s.
- Element ids have stable endings, sometimes with a repeater index: `plnMain_rptAssigmnetsByCourse_dgCourseAssignments_0`.
- Each class on the Assignments page is a `div.AssignmentClass` with a heading (`3500 - 1    AP Physics 1`) and a `.sg-right` average.

The parsers lean on that:

- `readTable()` (`src/hac/html.ts`) turns a grid into rows **keyed by header text**, so hidden or reordered columns don't break anything.
- `pick()` accepts alternative header names (`"Total Points"` or anything matching `/total p/i`).
- `byIdSuffix()` finds elements by the end of their id, with or without the `_0` index.

Score values: numbers count; blank, `X`, `EXC`, `I`, `P` and `NG` are ignored; `M`, `Z` and `Missing` count as 0 and are flagged missing.

### Marking periods

Switching marking periods is a WebForms postback. `buildMarkingPeriodForm()` copies every field the page sent (`__VIEWSTATE`, `__EVENTVALIDATION`, all dropdowns), changes `…ddlReportCardRuns`, sets `__EVENTTARGET` to the Refresh View button, and POSTs it back.

### Report card → calculator

`semesterColumns()` groups report card headers into semesters by name: periods (`1st`, `2nd`, `C1`, `Q1`…), exams (`EXM1`, `Exam1`, `E1`…) and semester grades (`SEM1`, `S1`…). The calculator uses these groups to pre-fill its inputs.

## Tests

`src/hac/__tests__/fixtures.ts` holds synthetic pages that copy HAC's real markup with made-up data. `parsers.test.ts` checks each parser against them, and `client.test.ts` runs the client against a fake HAC server: login, bad password, session expiry and re-login, marking-period postback, network errors.

## When your district looks different

If a page shows wrong or missing data:

1. Sign in to HAC in a desktop browser and open the page.
2. Save it (**File → Save Page As → "Webpage, HTML only"**).
3. **Remove personal info**: your name, student id, birthday and teacher names if you like. Grades can stay.
4. Add it as a fixture and write a failing test:

   ```ts
   // src/hac/__tests__/my-district.test.ts
   import { readFileSync } from 'fs';
   import { parseAssignmentsPage } from '../parsers/assignments';

   it('parses My ISD assignments', () => {
     const html = readFileSync(`${__dirname}/fixtures/my-isd-assignments.html`, 'utf8');
     const page = parseAssignmentsPage(html);
     expect(page.courses[0].reportedAverage).toBe(93.45);
   });
   ```

5. Adjust the selector or header name in the parser until it passes, and keep the existing tests green.

Common differences:
- **Different header text:** add an alternative to the `pick(...)` call.
- **Average shown elsewhere:** `parseCourse` checks `.sg-right` and then `[id$="lblHdrAverage"]`; add your district's element.
- **Login has extra fields** (e.g. a district picker): `buildLoginForm` copies every field with its default value, so usually nothing is needed. If your district's default `Database` option is wrong, that field needs a setting (not built yet).
