/** Color themes shared by web + mobile. `default` is free; the rest are premium. */
export interface Theme {
  id: string;
  name: string;
  primary: string;
  accent: string;
  premium: boolean;
}

export const THEMES: Theme[] = [
  { id: 'default', name: 'Classic', primary: '#2563EB', accent: '#22C55E', premium: false },
  { id: 'midnight', name: 'Midnight', primary: '#6366F1', accent: '#A78BFA', premium: true },
  { id: 'forest', name: 'Forest', primary: '#15803D', accent: '#84CC16', premium: true },
  { id: 'sunset', name: 'Sunset', primary: '#EA580C', accent: '#F43F5E', premium: true },
  { id: 'ocean', name: 'Ocean', primary: '#0891B2', accent: '#06B6D4', premium: true },
  { id: 'rose', name: 'Rose', primary: '#E11D48', accent: '#FB7185', premium: true },
  { id: 'grape', name: 'Grape', primary: '#7C3AED', accent: '#C084FC', premium: true },
  { id: 'gold', name: 'Gold', primary: '#CA8A04', accent: '#FACC15', premium: true },
  { id: 'slate', name: 'Slate', primary: '#475569', accent: '#94A3B8', premium: true },
  { id: 'mint', name: 'Mint', primary: '#0D9488', accent: '#5EEAD4', premium: true },
  { id: 'crimson', name: 'Crimson', primary: '#B91C1C', accent: '#F87171', premium: true },
];

/** Grade → color used across dashboards. */
export const gradeColor = (pct: number | null) =>
  pct === null ? '#9CA3AF' : pct >= 90 ? '#16A34A' : pct >= 80 ? '#2563EB' : pct >= 70 ? '#CA8A04' : '#DC2626';
