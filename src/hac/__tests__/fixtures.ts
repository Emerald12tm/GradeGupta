/**
 * Synthetic HAC pages for parser tests.
 *
 * These copy HAC's real markup patterns (class names, id suffixes, ASP.NET form fields)
 * but contain made-up data. To test against your district, save a page from your browser
 * (File → Save Page As → "HTML only"), drop the file here, and add a test. Remove your name
 * and student id from it first.
 */

export const LOGIN_PAGE = `
<html><body>
<form action="/HomeAccess/Account/LogOn?ReturnUrl=%2fHomeAccess%2f" method="post">
  <input name="__RequestVerificationToken" type="hidden" value="tok123" />
  <input name="SCKTY00328510CustomEnabled" type="hidden" value="False" />
  <input name="VerificationOption" type="hidden" value="UsernamePassword" />
  <select name="Database"><option value="5">Old</option><option selected="selected" value="10">Frisco ISD</option></select>
  <input name="LogOnDetails.UserName" type="text" value="" />
  <input name="LogOnDetails.Password" type="password" />
  <button type="submit">Sign In</button>
</form>
</body></html>`;

export const LOGIN_FAILED_PAGE = LOGIN_PAGE.replace(
  '<form',
  '<div class="validation-summary-errors"><ul><li>Your attempt to log in was unsuccessful.</li></ul></div><form',
);

export const HOME_PAGE = `<html><body><div id="home">Welcome, Test Student</div></body></html>`;

const header = (cells: string[]) =>
  `<tr class="sg-asp-table-header-row">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
const row = (cells: string[]) => `<tr class="sg-asp-table-data-row">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;

const ASSIGNMENT_HEADERS = ['Date Due', 'Date Assigned', 'Assignment', 'Category', 'Score', 'Total Points', 'Weight', 'Weighted Score', 'Weighted Total Points', 'Average Score', 'Percentage'];
const CATEGORY_HEADERS = ['Category', "Student's Points", 'Maximum Points', 'Percent', 'Category Weight', 'Category Points'];

export const assignmentsPage = (selectedRun = '1-2026', physicsTest = '80.00') => `
<html><body>
<form method="post" action="./Assignments.aspx" id="aspnetForm">
  <input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" />
  <input type="hidden" name="__EVENTARGUMENT" id="__EVENTARGUMENT" value="" />
  <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="vs==" />
  <input type="hidden" name="__VIEWSTATEGENERATOR" value="B0B4" />
  <input type="hidden" name="__EVENTVALIDATION" value="ev==" />
  <select name="ctl00$plnMain$ddlReportCardRuns" id="plnMain_ddlReportCardRuns">
    <option ${selectedRun === '1-2026' ? 'selected="selected"' : ''} value="1-2026">1</option>
    <option ${selectedRun === '2-2026' ? 'selected="selected"' : ''} value="2-2026">2</option>
  </select>
  <select name="ctl00$plnMain$ddlClasses"><option selected="selected" value="ALL">All Classes</option></select>
  <input type="submit" name="ctl00$plnMain$btnRefreshView" value="Refresh View" id="plnMain_btnRefreshView" />

  <div class="AssignmentClass">
    <div class="sg-header sg-header-square">
      <a class="sg-header-heading" href="#">3500 - 1&nbsp;&nbsp;&nbsp;&nbsp;AP Physics 1</a>
      <span class="sg-header-heading sg-right">Student Grades 86.00%</span>
    </div>
    <div class="sg-content-grid">
      <table id="plnMain_rptAssigmnetsByCourse_dgCourseAssignments_0" class="sg-asp-table">
        ${header(ASSIGNMENT_HEADERS)}
        ${row(['09/12/2026', '09/08/2026', '<a href="#" title="Title: Unit 1 Test">Unit 1 Test</a>', 'Major', physicsTest, '100.00', '1.00', '', '', '', ''])}
        ${row(['09/05/2026', '09/01/2026', '<a href="#">Lab 1 *</a>', 'Daily', '100.00', '100.00', '1.00', '', '', '', ''])}
        ${row(['09/06/2026', '09/02/2026', '<a href="#">Homework 1</a>', 'Daily', '90.00', '100.00', '1.00', '', '', '', ''])}
        ${row(['09/20/2026', '09/18/2026', '<a href="#">Homework 2</a>', 'Daily', '&nbsp;', '100.00', '1.00', '', '', '', ''])}
      </table>
      <table id="plnMain_rptAssigmnetsByCourse_dgCourseCategories_0" class="sg-asp-table">
        ${header(CATEGORY_HEADERS)}
        ${row(['Major', '80.0000', '100.0000', '80.000%', '60.0000', '48.0000'])}
        ${row(['Daily', '190.0000', '200.0000', '95.000%', '40.0000', '38.0000'])}
        ${row(['Total', '', '', '', '100.0000', '86.0000'])}
      </table>
    </div>
  </div>

  <div class="AssignmentClass">
    <div class="sg-header sg-header-square">
      <a class="sg-header-heading" href="#">1234 - 2    Algebra II H</a>
      <span class="sg-header-heading sg-right">Student Grades 36.25%</span>
    </div>
    <div class="sg-content-grid">
      <table id="plnMain_rptAssigmnetsByCourse_dgCourseAssignments_1" class="sg-asp-table">
        ${header(ASSIGNMENT_HEADERS)}
        ${row(['09/03/2026', '09/01/2026', '<a href="#">Quiz</a>', 'Daily', '70.00', '100.00', '1.00', '', '', '', ''])}
        ${row(['09/03/2026', '09/01/2026', '<a href="#">Quiz</a>', 'Daily', 'M', '100.00', '1.00', '', '', '', ''])}
        ${row(['09/04/2026', '09/01/2026', '<a href="#">Quiz 3</a>', 'Daily', 'X', '100.00', '1.00', '', '', '', ''])}
        ${row(['09/05/2026', '09/05/2026', '<a href="#">Bonus question</a>', 'Daily', '2.50', '', '1.00', '', '', '', ''])}
      </table>
      <table id="plnMain_rptAssigmnetsByCourse_dgCourseCategories_1" class="sg-asp-table">
        ${header(CATEGORY_HEADERS)}
        ${row(['Daily', '70.0000', '200.0000', '35.000%', '100.0000', '35.0000'])}
      </table>
    </div>
  </div>
</form>
</body></html>`;

export const SCHEDULE_PAGE = `
<table id="plnMain_dgSchedule" class="sg-asp-table">
  ${header(['Course', 'Description', 'Periods', 'Teacher', 'Room', 'Days', 'Marking Periods', 'Building', 'Status'])}
  ${row(['3500 - 1', 'AP Physics 1', '1', '<a href="mailto:teacher@district.example">Smith, Jane</a>', 'B204', 'A', 'Q1, Q2, Q3, Q4', 'High School', 'Active'])}
  ${row(['1234 - 2', 'Algebra II H', '2', 'Lee, Sam', 'C110', 'B', 'Q1, Q2', 'High School', 'Active'])}
</table>`;

export const TRANSCRIPT_PAGE = `
<div class="sg-transcript-group">
  <table><tr><td><span id="plnMain_rpTranscriptGroup_lblYearValue_0">2025-2026</span></td>
  <td><span id="plnMain_rpTranscriptGroup_lblGradeValue_0">10</span></td></tr></table>
  <table id="plnMain_rpTranscriptGroup_dgCourses_0" class="sg-asp-table">
    ${header(['Course', 'Description', 'Sem1', 'Sem2', 'CRD'])}
    ${row(['3400', 'AP World History', '93', '95', '1.0000'])}
    ${row(['1200', 'Geometry H', '88', '', '0.5000'])}
    ${row(['Total Credit', '', '', '', '1.5000'])}
  </table>
</div>
<table id="plnMain_rp_tblCumGPAInfo">
  <tr><td>Weighted GPA</td><td>4.3215</td></tr>
  <tr><td>Unweighted GPA</td><td>3.9100</td></tr>
</table>
<span id="plnMain_lblRankValue">12 / 640</span>`;

export const REPORT_CARD_PAGE = `
<table id="plnMain_dgReportCard" class="sg-asp-table">
  ${header(['Course', 'Description', 'Period', 'Teacher', 'Room', 'Att. Credit', 'Ern. Credit', '1st', '2nd', 'EXM1', 'SEM1', '3rd', '4th', 'EXM2', 'SEM2'])}
  ${row(['3500 - 1', 'AP Physics 1', '1', 'Smith, Jane', 'B204', '1.000', '0.500', '92', '88', '84', '89', '', '', '', ''])}
</table>`;

export const ATTENDANCE_PAGE = `
<table id="plnMain_cldAttendance">
  <tr><td colspan="7">October 2026</td></tr>
  <tr><td title="">1</td><td title="Tardy&#10;Period 1">2</td><td>3</td><td title="Excused Absence">14</td></tr>
</table>`;

export const REGISTRATION_PAGE = `
<span id="plnMain_lblRegStudentName">Test Student</span>
<span id="plnMain_lblGrade">11</span>
<span id="plnMain_lblBuildingName">Example High School</span>`;
