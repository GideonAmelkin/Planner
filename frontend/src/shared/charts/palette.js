// Chart colors for the light card surface. Every data mark here is at least 3:1
// against white (WCAG non-text contrast), measured 2026-09-27:
//   blue #1A6FD1 4.95, green #1F8A45 4.39, goal (COLORS.done) #3BA55D 3.12,
//   orange #C8611A 4.05, amber #B8860B 3.25, red #D0342C 4.99, purple #6B4FD8 5.62,
//   grey (COLORS.muted) #7B7B76 4.25.
// The Garmin app's own ring colors fail on white and are not used: steps #11a9ed 2.65,
// step fill #72ea24 1.55, intensity / stress orange #f27716 2.83, phone orange #F28C1E 2.46.
// The ring track (COLORS.hairline, 1.19) is a background, not a mark; the mark on it is
// what carries the value.
import { COLORS } from '../styles';

export const CHART = {
  blue: '#1A6FD1',
  green: '#1F8A45',
  goal: COLORS.done,
  orange: '#C8611A',
  amber: '#B8860B',
  red: '#D0342C',
  purple: '#6B4FD8',
  grey: COLORS.muted,
  track: COLORS.hairline,
  ink: COLORS.ink,
  muted: COLORS.muted,
  faint: COLORS.faint,
};

// Heart rate zones, in Garmin's order below zone 1 then zones 1 to 5.
export const HR_ZONE_COLORS = [CHART.grey, CHART.grey, CHART.blue, CHART.green, CHART.orange, CHART.red];
// Garmin stress bands: rest 0-25, low 26-50, medium 51-75, high 76-100.
export const STRESS_BANDS = [
  { key: 'rest', label: 'Rest', color: CHART.blue },
  { key: 'low', label: 'Low', color: CHART.amber },
  { key: 'medium', label: 'Medium', color: CHART.orange },
  { key: 'high', label: 'High', color: CHART.red },
];
export const VO2_BAND_COLORS = { Poor: CHART.red, Fair: CHART.orange, Good: CHART.green, Excellent: CHART.blue, Superior: CHART.purple };
