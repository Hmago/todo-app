/**
 * Categorical effort estimate ("Low/Medium/High") mapped to a canonical
 * minute count. The numeric value is still what gets persisted in
 * `Task.estimateMinutes`, which keeps the day-timeline, calendar sync and
 * analytics consumers working unchanged.
 */
export type EstimateLevel = 'low' | 'medium' | 'high';

export const ESTIMATE_LEVELS: EstimateLevel[] = ['low', 'medium', 'high'];

/** Canonical minutes for each level. */
export const ESTIMATE_MINUTES: Record<EstimateLevel, number> = {
  low: 15,
  medium: 60,
  high: 180,
};

/** Map a minute count back to the closest level. */
export function estimateLevelOf(minutes: number | undefined): EstimateLevel | undefined {
  if (minutes == null || minutes <= 0) return undefined;
  if (minutes < 30) return 'low';
  if (minutes < 120) return 'medium';
  return 'high';
}

export function estimateLabel(level: EstimateLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}
