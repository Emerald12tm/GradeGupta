# Grade math

All formulas live in `src/grades/` as pure functions, and every example below is a unit test in `src/grades/__tests__/grades.test.ts`.

## Class average (`average.ts`)

HAC weights categories:

```
category average = Σ(score × weight) / Σ(total points × weight) × 100
class average    = Σ(category average × category weight)
```

- `weight` is HAC's per-assignment multiplier (usually 1).
- Ungraded and excused assignments (blank, `X`, `EXC`, …) don't count. Missing (`M`, `Z`) counts as 0.
- If a category has no grades yet, its weight is spread proportionally over the others, so with only Daily grades, Daily counts 100%.
- If no category has a weight, the course is points-based: total earned / total possible.

**Example.** Major 60%, Daily 40%. Major: 80/100. Daily: 100 and 90 (95%).
Average = 0.6 × 80 + 0.4 × 95 = **86**.

`categoryImpact` ranks categories by points lost, (100 − category avg) × effective weight. Here Major costs 12 points and Daily 2.

## What-if (`whatif.ts`)

Edits are an overlay on top of the HAC data: added made-up assignments, score overrides and dropped assignments. The average is recomputed with the same formula. Nothing is changed in HAC.

Same example: drop the 90 homework → Daily 100 → 0.6 × 80 + 0.4 × 100 = **88**.

## What do I need? (`target.ts`)

The score on one more assignment (category, points) that brings the class average to the target. Because adding a grade can change category weighting (for example the first Major grade), it's solved by bisection over the score rather than by algebra.

Example: target 90 with one more 100-point Major. Major must reach (90 − 38) / 0.6 = 86.67, so (80 + s) / 2 = 86.67 and **s = 93.3**.

## Semester and final exam (`semester.ts`)

```
semester = Σ wᵢ · periodᵢ + w_exam · exam
```

Weights come from Settings (presets: 42.5/42.5/15, 40/40/20, 45/45/10, 3 × six-weeks + exam, or custom). They're normalized, so 42.5/42.5/15 and 0.425/0.425/0.15 mean the same thing. Without an exam score, the exam weight is spread over the periods, which matches how HAC shows a semester in progress.

### Rounding

HAC shows semester grades as whole numbers. A posted **89** means the real value is somewhere in **[88.5, 89.5)**. The calculator respects this:

- **Exam needed** for a target of 90 only requires reaching 89.5.
- **Working backward** gives a *range*, not one number. If the period grades you typed are rounded too (report card values), the range widens to match.

### Before the final

```
exam needed = (target − 0.5 − Σ wᵢ · periodᵢ) / w_exam
```

Example (42.5/42.5/15): periods 92 and 88. To finish with a 90: (89.5 − 76.5) / 0.15 = **86.7**.
A result ≤ 0 means guaranteed; > 100 means not possible.

### After the final: what did I get?

```
exam = (semester − Σ wᵢ · periodᵢ) / w_exam
```

Example: periods 92 and 88, posted semester 89.
Estimate (89 − 76.5) / 0.15 = 83.3. Range: (88.5 − 76.5) / 0.15 = **80.0** to (89.5 − 76.5) / 0.15 = **86.7**. A real exam score of 84 gives 89.1, which shows as 89, inside the range.

If no score from 0 to 100 fits, the app says so. That almost always means the teacher counted something you can't see, or the formula is different.

## Hidden grades (`solver.ts`, `impliedPeriodGrade`)

Some teachers enter the final (or another test) so that it changes an average before the assignment shows up, or they put the exam inside a grading period instead of its own column. If you know where the grade went and what it was worth, only one score makes the posted average come out right.

### From the class average

Tell the solver the category, the point value and the HAC weight of the hidden grade. It searches for the score that makes the visible assignments plus the hidden one equal the posted average. The class average only goes up as the hidden score goes up, so bisection finds it exactly, including category redistribution.

Example: the visible grades average 86 (above), but HAC shows **90.50**. A hidden 100-point Major test scoring *s* gives Major (80 + s) / 2, and 0.6 × (80 + s) / 2 + 38 = 90.5, so **s = 95**.

The class screen flags this automatically: if HAC's average differs from what the visible assignments produce by more than rounding noise, it shows "The average doesn't match the visible assignments" with a link to the solver.

### From the semester grade

When the exam was folded into a grading period:

1. `impliedPeriodGrade` solves the semester formula for the one unknown period:
   `period = (semester − exam part − other periods) / w_period`.
   Example (42.5/42.5/15): period 1 = 92, separate exam 84, posted semester 89 → period 2 ≈ 87.8.
   With no separate exam the exam weight is spread over the periods: period 1 = 92, semester 90 → period 2 = 88 (range 87 to 89 with rounding).
2. If you pick the class, the hidden-assignment solver then turns that period grade into the test score.

## GPA (`gpa.ts`)

```
GPA = Σ(points × credits) / Σ credits
```

- **Letter scale:** A 4, B 3, C 2, below 70 0, plus a level bonus (Honors +0.5, AP/IB/DC +1) on passing grades.
- **Linear scale:** the top grade earns the level's maximum (e.g. AP 6.0); each point below subtracts 0.1. So AP 95 → 5.5.
- Unweighted GPA treats every class as Regular.
- Level is guessed from the course name (`AP`, `IB`, `DC`, `H`/`Honors`/`PAP`/`GT`…) and can be overridden per class.
- The Transcript screen applies this to past semester grades, each semester counting for its share of the course's credits.
