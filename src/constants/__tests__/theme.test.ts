import { blend, contrastRatio } from '../contrast';
import { THEMES, TINT_ALPHA, type Palette } from '../theme';

/**
 * Keeps every theme readable. Text must reach WCAG AA (4.5:1) on the surfaces it's drawn on,
 * including the tinted backgrounds used by pills, badges and banners; controls like the
 * switch's off track must reach 3:1.
 */

const TEXT = 4.5;
const UI = 3;

function failures(p: Palette): string[] {
  const out: string[] = [];
  const check = (name: string, fg: string, bg: string, min: number) => {
    const r = contrastRatio(fg, bg);
    if (r < min) out.push(`${name} ${r.toFixed(2)} < ${min}`);
  };
  for (const surface of ['background', 'backgroundElement'] as const) {
    for (const key of ['text', 'textSecondary', 'tint', 'success', 'warning', 'danger', 'gradeA', 'gradeB', 'gradeC', 'gradeF'] as const) {
      check(`${key} on ${surface}`, p[key], p[surface], TEXT);
    }
  }
  for (const key of ['tint', 'success', 'warning', 'danger', 'gradeA', 'gradeB', 'gradeC', 'gradeF'] as const) {
    check(`${key} on its tinted pill`, p[key], blend(p[key], TINT_ALPHA, p.backgroundElement), TEXT);
  }
  check('onTint on tint', p.onTint, p.tint, TEXT);
  check('textSecondary on segmented track', p.textSecondary, p.backgroundSelected, TEXT);
  check('switch off track / input border on card', p.track, p.backgroundElement, UI);
  check('input border on screen background', p.track, p.background, UI);
  return out;
}

describe.each(THEMES.flatMap((t) => (['light', 'dark'] as const).map((m) => [`${t.name} ${m}`, t[m]] as const)))(
  '%s',
  (_name, palette) => {
    it('meets contrast minimums', () => {
      expect(failures(palette)).toEqual([]);
    });
  },
);
