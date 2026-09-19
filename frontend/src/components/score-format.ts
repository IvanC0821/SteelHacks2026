// Number formatting for Score. Kept out of Score.tsx so that file only exports a component.

/** At most one decimal, no trailing ".0": 8 → "8", 7.46 → "7.5". */
export function formatPoints(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A signed delta with a real minus sign: "+2", "−1.5", "0". */
export function formatDelta(value: number): string {
  if (value > 0) return `+${formatPoints(value)}`;
  if (value < 0) return `−${formatPoints(Math.abs(value))}`;
  return "0";
}

/** Credit green above zero, deduction red below, neutral at zero. */
export function deltaToneClass(value: number): string {
  if (value > 0) return "v-score--credit";
  if (value < 0) return "v-score--deduction";
  return "v-score--neutral";
}
