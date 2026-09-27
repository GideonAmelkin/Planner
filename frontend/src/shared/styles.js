// Design tokens and the style objects shared across the planner's inline styles.
// The look is a card app: white cards on a warm grey canvas, DM Sans, indigo accent.
// Every key here is read by the Agenda, the Workout tab and the shared modals, so
// values may change but keys stay.

export const COLORS = {
  ink: '#1E1E1E',        // text
  paper: '#FFFFFF',      // card surface
  page: '#F5F4F0',       // canvas behind the cards
  hairline: '#ECEBE6',   // dividers, card borders
  muted: '#7B7B76',      // secondary text
  accent: '#5B6BF0',     // indigo: checks, today, current time, primary actions
  faint: '#C4C3BE',      // placeholders, out-of-month days, idle icons
  todayCell: '#EEF0FE',  // indigo wash
  danger: '#D64545',
  dangerBg: '#FDECEA',
  done: '#3BA55D',
  google: '#4285F4',
  outlook: '#0F6CBD',
  garmin: '#007CC3',
  workout: '#B5471B',
  social: '#D93A6A',    // the Social tab's section dot
  calloutBg: '#EEF0FE',  // the quote callout
  calloutText: '#2F3A9E',
  allDayBg: '#E8F0FE',
  allDayText: '#1B4FBF',
};

export const INDENT_PX = 24;
export const RADIUS = 12;
export const CARD_SHADOW = '0 1px 2px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.04)';

// A white card on the canvas.
export const card = {
  background: COLORS.paper,
  borderRadius: RADIUS,
  boxShadow: CARD_SHADOW,
  padding: '20px 22px',
};

// Small grey pill (day badge, counts).
export const pill = {
  display: 'inline-block',
  background: COLORS.page,
  color: COLORS.muted,
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

// Priority chips in Action Items.
export const PRIORITY_CHIPS = {
  A: { bg: '#FDE2DC', fg: '#B43E2B' },
  B: { bg: '#FFF0C7', fg: '#8A5A00' },
  C: { bg: '#E6E6F8', fg: '#4A4A9C' },
};

// Header washes on the two Monthly Goals cards.
export const GOAL_WASH = {
  personal: { bg: '#DDE8F7', fg: '#2B4C7E' },
  business: { bg: '#F3E4CF', fg: '#7A4B12' },
};

// The coloured dot in front of each section title.
export const SECTION_DOTS = {
  schedule: '#4285F4',
  action: COLORS.accent,
  tasks: '#E2A33B',
  ongoing: '#2AA198',
  notes: '#9A9A94',
};
export const sectionDot = (color) => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: color,
  marginRight: 8,
  verticalAlign: 1,
  flexShrink: 0,
});

// Section title inside a card ("Appointment Schedule", "Tasks", ...).
export const sectionTitle = {
  fontSize: 13,
  fontWeight: 600,
  color: COLORS.ink,
  textAlign: 'left',
};
export const sectionHeader = {
  ...sectionTitle,
  padding: '0 0 10px',
};

// Card title used for Monthly Goals, the Calendar month and the Workout page.
export const uppercaseHeading = {
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: -0.3,
  lineHeight: 1.2,
};

// Borderless text input that sits on a row.
export const rowInput = {
  border: 'none',
  background: 'transparent',
  padding: '6px 10px',
  fontSize: 15,
  width: '100%',
  color: COLORS.ink,
};
export const newRowInput = { ...rowInput };

// "Add" row at the foot of a list.
export const newRowShell = {
  alignItems: 'center',
  background: 'transparent',
};

// Child rows are indented, no bullet.
export const childDash = { display: 'none' };

// The "+" that adds a sub-item to a parent row.
export const addChildButton = {
  border: 'none',
  background: 'transparent',
  color: COLORS.faint,
  fontSize: 16,
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
  alignSelf: 'center',
};

// Row borders while a drag hovers above or below it.
export const dropZoneBorders = (dropZone) => ({
  borderTop: dropZone === 'above' ? `2px solid ${COLORS.accent}` : '2px solid transparent',
  borderBottom: dropZone === 'below' ? `2px solid ${COLORS.accent}` : '2px solid transparent',
});

// Button in the rail and the light header (Prev / Today / Next / Recap / Settings).
export const navButton = {
  color: COLORS.ink,
  textDecoration: 'none',
  border: `1px solid ${COLORS.hairline}`,
  padding: '5px 12px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0,
  borderRadius: 8,
  background: COLORS.paper,
  lineHeight: 1.3,
};

// Small outlined action button (Save / Delete / Connect / Disconnect).
export const outlineButton = (color = COLORS.ink, { small = false, disabled = false } = {}) => ({
  border: `1px solid ${disabled ? COLORS.hairline : color}`,
  background: disabled ? COLORS.page : COLORS.paper,
  color: disabled ? COLORS.faint : color,
  fontSize: small ? 11 : 12,
  padding: small ? '3px 8px' : '5px 12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: 8,
  fontWeight: 600,
  letterSpacing: 0.2,
});

// Modal shell shared by Settings and Recap.
export const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(30, 30, 30, 0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 80,
  zIndex: 100,
};
export const modalCard = {
  background: COLORS.paper,
  border: 'none',
  borderRadius: RADIUS,
  boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
  padding: 24,
};
export const modalTitle = { fontSize: 20, fontWeight: 600, color: COLORS.ink };
export const modalClose = {
  border: 'none',
  background: 'transparent',
  fontSize: 22,
  cursor: 'pointer',
  color: COLORS.muted,
};
