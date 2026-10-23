/**
 * WCAG 2.x contrast math, used by the theme tests to keep every palette readable.
 * Text needs 4.5:1 against its background; large text and UI parts (switch tracks,
 * borders that carry meaning) need 3:1.
 */

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '').slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** The solid color you see when `top` at `alpha` is drawn over `bottom` (for tinted backgrounds). */
export function blend(top: string, alpha: number, bottom: string): string {
  const t = rgb(top);
  const b = rgb(bottom);
  return `#${t.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}
