import { COLORS } from '../shared/styles';

// The Workout tab's own look since 2026-09-29, taken from a clinical-dashboard mockup the user
// picked: a soft blue page, frosted white cards with large radii, pastel tiles, round icon
// buttons. Only the Workout tab reads this file; shared/styles.js keeps the Planner-wide tokens
// (ink, muted, accent, ...) that these build on.

export const W = {
  pageTop: '#E9F0FF',
  pageBottom: '#F6F8FD',
  glow: 'rgba(120, 150, 255, 0.22)',
  glass: 'rgba(255, 255, 255, 0.74)',
  glassStrong: 'rgba(255, 255, 255, 0.9)',
  glassBorder: 'rgba(255, 255, 255, 0.9)',
  blue: '#4F7BF7',
  blueSoft: '#DCE6FF',
  blueWash: '#EEF3FF',
  green: '#2FB67C',
  yellowTile: '#FBF5C4',
  yellowInk: '#6B5A00',
  blueTile: '#D9E6FB',
  blueInk: '#1F3F8A',
  chip: '#F2F4FA',
};

export const RADIUS_L = 24;
export const GLASS_SHADOW = '0 1px 2px rgba(30, 50, 110, .05), 0 12px 32px rgba(30, 50, 110, .08)';

// The page behind every Workout view: a blue radial glow over a top-to-bottom wash.
export const pageBackground = `radial-gradient(1200px 600px at 55% 18%, ${W.glow}, transparent 70%), linear-gradient(180deg, ${W.pageTop} 0%, ${W.pageBottom} 55%)`;

// The frosted card every Workout view is built from.
export const glassCard = {
  background: W.glass,
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: `1px solid ${W.glassBorder}`,
  borderRadius: RADIUS_L,
  boxShadow: GLASS_SHADOW,
  padding: '20px 22px',
};

// Round white icon button (Prev / Next, zoom, the strip's arrows).
export const roundButton = (size = 36) => ({
  width: size,
  height: size,
  borderRadius: '50%',
  border: `1px solid ${COLORS.hairline}`,
  background: W.glassStrong,
  color: COLORS.ink,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
  textDecoration: 'none',
  flexShrink: 0,
  padding: 0,
});

// White stat pill ("64 kg"): number in ink, unit small and muted.
export const statPill = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 3,
  background: W.glassStrong,
  border: `1px solid ${COLORS.hairline}`,
  borderRadius: 999,
  padding: '7px 13px',
  fontSize: 15,
  fontWeight: 600,
  color: COLORS.ink,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

// Black disc with a white glyph, the mockup's card icon.
export const iconDisc = (size = 34) => ({
  width: size,
  height: size,
  borderRadius: '50%',
  background: COLORS.ink,
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

// Hatched fill for the peak bar.
export const hatch = (color) => `repeating-linear-gradient(135deg, ${color} 0 6px, rgba(255,255,255,.35) 6px 9px)`;
