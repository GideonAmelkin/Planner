// Design tokens and the style objects shared across the planner's inline styles.
// The look is the Franklin Planner paper book: ink on cream, thin hairlines.

export const COLORS = {
  ink: '#2D3436',        // text, strong rules, the nav bar
  paper: '#FBF6E7',      // page surface
  page: '#F0EAD6',       // body background behind the pages
  hairline: '#C9BB9A',   // row rules
  muted: '#6B5B40',      // secondary text, hour labels
  accent: '#A89368',     // "+" affordances, placeholders, unchecked marks
  faint: '#B5A88A',      // out-of-month days, dashed spread divider
  todayCell: '#F4ECD2',  // today's cell in the Calendar section
  danger: '#C62828',
  dangerBg: '#FFEBEE',
  done: '#2E7D32',       // completed check
  google: '#1565C0',
  outlook: '#00695C',
};

export const INDENT_PX = 24;

// Italic centered heading inside a section ("Appointment Schedule", "Tasks", ...).
export const sectionTitle = {
  fontStyle: 'italic',
  fontSize: 13,
  color: COLORS.ink,
  textAlign: 'center',
  fontWeight: 500,
};
export const sectionHeader = {
  ...sectionTitle,
  padding: '4px 0',
  borderBottom: `1px solid ${COLORS.ink}`,
};

// Big uppercase headline used for the date and the Monthly Goals / Calendar titles.
export const uppercaseHeading = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: 1,
  paddingTop: 4,
  lineHeight: 1.2,
  textTransform: 'uppercase',
};

// Borderless text input that sits on a ruled row.
export const rowInput = {
  border: 'none',
  background: 'transparent',
  padding: '4px 8px',
  fontSize: 14,
  width: '100%',
  color: COLORS.ink,
};
export const newRowInput = { ...rowInput, padding: '6px 8px' };

// Ruled "add" row at the foot of a list.
export const newRowShell = {
  alignItems: 'center',
  borderBottom: `1px solid ${COLORS.hairline}`,
  background: COLORS.paper,
};

// The "-" bullet in front of a child row.
export const childDash = { color: COLORS.accent, fontSize: 14, paddingLeft: 4, paddingRight: 4 };

// The "+" that adds a sub-item to a parent row.
export const addChildButton = {
  border: 'none',
  background: 'transparent',
  color: COLORS.accent,
  fontSize: 16,
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
  alignSelf: 'center',
};

// Row borders while a drag hovers above or below it.
export const dropZoneBorders = (dropZone) => ({
  borderTop: dropZone === 'above' ? `2px solid ${COLORS.ink}` : 'none',
  borderBottom: dropZone === 'below' ? `2px solid ${COLORS.ink}` : `1px solid ${COLORS.hairline}`,
});

// White-on-ink outline button in the top nav (Prev / Today / Next / Recap / Settings).
export const navButton = {
  color: 'white',
  textDecoration: 'none',
  border: '1px solid white',
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  borderRadius: 2,
  background: 'transparent',
};

// Small outlined action button (Save / Delete / Connect / Disconnect).
export const outlineButton = (color = COLORS.ink, { small = false, disabled = false } = {}) => ({
  border: `1px solid ${color}`,
  background: disabled ? COLORS.page : 'white',
  color: disabled ? COLORS.accent : color,
  fontSize: small ? 11 : 12,
  padding: small ? '3px 8px' : '5px 12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: 2,
  fontWeight: 600,
  letterSpacing: 0.3,
});

// Modal shell shared by Settings and Recap.
export const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(45, 52, 54, 0.5)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 80,
  zIndex: 100,
};
export const modalCard = {
  background: COLORS.paper,
  border: `1px solid ${COLORS.ink}`,
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  padding: 20,
};
export const modalTitle = { fontSize: 20, fontWeight: 500, color: COLORS.ink };
export const modalClose = {
  border: 'none',
  background: 'transparent',
  fontSize: 22,
  cursor: 'pointer',
  color: COLORS.ink,
};
