// Design tokens and shared style objects for the Garmin tab, measured from
// connect.garmin.com (Open Sans, white cards on #efefef, blue #1265c2 actions).
// Nothing here is used by the Agenda tab; that keeps styles.js.

export const G = {
  font: '"Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
  text: '#101010',
  muted: '#6c6c6c',
  faint: '#c3c3c3',
  border: '#e4e4e4',
  page: '#efefef',
  surface: '#ffffff',
  surface2: '#f4f4f4',
  nav: '#1a1a1a',
  blue: '#1265c2',
  blueHover: '#0a59b2',
  green: '#16a544',
  greenDark: '#0b963f',
  shadow: '0 4px 8px -4px rgba(0,0,0,0.08), 0 2px 2px rgba(0,0,0,0.1), 0 0 2px rgba(0,0,0,0.1), 0 0 4px rgba(0,0,0,0.12)',
  metric: {
    activity: '#16a544',
    heart: '#e02c2c',
    battery: '#1265c2',
    stress: '#f27716',
    intensity: '#f27716',
    intensityFill: '#11a9ed',
    steps: '#11a9ed',
    stepsFill: '#72ea24',
    floors: '#16a544',
    calories: '#16a544',
    sleep: '#6f42f3',
    spo2: '#e02c2c',
    respiration: '#15aabf',
    hydration: '#1265c2',
    hrv: '#6f42f3',
    training: '#1265c2',
    weight: '#6c6c6c',
    endpoints: '#6c6c6c',
  },
  sleep: {
    deep: '#004ba0',
    light: '#54a9fe',
    rem: '#d42fc2',
    awake: '#ff6f6f',
  },
};

export const page = { background: G.page, minHeight: '100vh' };

// White band under the nav: section label, date, Today / prev / next, synced time.
export const headerBand = {
  background: G.surface,
  borderBottom: `1px solid ${G.border}`,
  padding: '14px min(24px, 4vw) 14px',
};
export const sectionLabel = {
  fontSize: 11,
  fontWeight: 300,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: '#222222',
};
export const dateTitle = {
  fontSize: 22,
  fontWeight: 300,
  color: G.blue,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  lineHeight: 1.3,
};
export const syncedText = { fontSize: 12, color: G.muted };

export const pillButton = (disabled = false) => ({
  background: disabled ? '#9bbfe6' : G.blue,
  color: 'white',
  border: 'none',
  borderRadius: 4,
  padding: '4px 16px',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '16px',
  cursor: disabled ? 'default' : 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
  fontFamily: G.font,
});
export const outlineButton = (disabled = false) => ({
  ...pillButton(disabled),
  background: 'white',
  color: disabled ? G.faint : G.blue,
  border: `1px solid ${disabled ? G.border : G.blue}`,
  padding: '3px 14px',
});
export const chevronButton = {
  background: 'transparent',
  border: 'none',
  color: G.text,
  fontSize: 18,
  lineHeight: 1,
  padding: '2px 6px',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: G.font,
};

// Cards ------------------------------------------------------------------------
export const card = {
  background: G.surface,
  border: `1px solid ${G.border}`,
  borderRadius: 8,
  boxShadow: G.shadow,
  padding: 0,
  overflow: 'hidden',
  minWidth: 0,
};
export const cardHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '12px 16px',
  borderBottom: `1px solid ${G.border}`,
};
export const cardTitle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: G.text,
};
export const cardBody = { padding: '16px 16px 18px' };
export const cardFooter = {
  borderTop: `1px solid ${G.border}`,
  padding: '8px 16px',
  display: 'flex',
  justifyContent: 'flex-end',
};
export const footerLink = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: G.blue,
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: 2,
  textTransform: 'uppercase',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: G.font,
};

// Numbers ------------------------------------------------------------------------
export const headline = {
  fontSize: 48,
  fontWeight: 300,
  lineHeight: 1.1,
  color: G.text,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: -0.5,
};
export const headlineUnit = { fontSize: 12, color: G.muted, fontWeight: 400, marginLeft: 6 };
export const statValue = { fontSize: 18, fontWeight: 300, color: G.text, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' };
export const statLabel = { fontSize: 12, color: G.muted, marginTop: 2 };
export const statRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
  gap: '10px 16px',
  alignItems: 'start',
};

// Progress bar: 20px track, square corners, like the Steps / Intensity cards.
export const track = { background: G.border, height: 20, width: '100%', position: 'relative', overflow: 'hidden' };
export const fill = (color, pct) => ({
  background: color,
  height: '100%',
  width: `${Math.max(0, Math.min(100, pct || 0))}%`,
  transition: 'width 200ms ease',
});

// Activity block: solid green with white text and a darker footer bar.
export const activityCard = {
  background: G.green,
  color: 'white',
  borderRadius: 8,
  boxShadow: G.shadow,
  overflow: 'hidden',
};
export const activityFooter = {
  background: G.greenDark,
  color: 'white',
  padding: '6px 16px',
  display: 'flex',
  justifyContent: 'flex-end',
};

// The Garmin Connect frame: sidebar, top bar, header, content ---------------------
export const SIDEBAR_W = 268;
export const COLUMN_W = 932;

export const sidebar = {
  width: SIDEBAR_W,
  flex: `0 0 ${SIDEBAR_W}px`,
  background: G.nav,
  color: 'white',
  position: 'sticky',
  top: 0,
  height: '100vh',
  overflowY: 'auto',
  fontFamily: G.font,
};
export const wordmark = {
  fontSize: 30,
  fontWeight: 300,
  letterSpacing: 0.5,
  color: 'white',
  padding: '14px 18px 18px',
  textDecoration: 'none',
  display: 'block',
  lineHeight: 1.1,
};
export const sidebarItem = (active = false) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  height: 40,
  padding: '0 18px 0 18px',
  borderLeft: `4px solid ${active ? 'white' : 'transparent'}`,
  color: 'white',
  fontSize: 16,
  fontWeight: 300,
  textDecoration: 'none',
  background: 'transparent',
  border: 'none',
  borderLeftWidth: 4,
  borderLeftStyle: 'solid',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: G.font,
  whiteSpace: 'nowrap',
});
export const sidebarDivider = { borderTop: '1px solid #3b3b3b', margin: '8px 0' };

export const topBar = {
  height: 60,
  background: G.surface,
  borderBottom: `1px solid ${G.faint}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 30px',
};
export const circleButton = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: `1px solid ${G.faint}`,
  background: 'white',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: G.muted,
  textDecoration: 'none',
  padding: 0,
};
export const iconButton = {
  background: 'transparent',
  border: 'none',
  padding: 6,
  cursor: 'pointer',
  color: G.muted,
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: G.font,
};

export const summaryHeader = {
  background: G.surface,
  borderBottom: `1px solid ${G.border}`,
  padding: '18px 30px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
};
export const contentArea = { background: G.page, padding: 30, minHeight: 'calc(100vh - 60px)' };
export const column = { maxWidth: COLUMN_W, display: 'flex', flexDirection: 'column', gap: 16 };

// Sub-page primitives (measured on connect.garmin.com/app/sleep) --------------------
export const container = {
  background: G.surface,
  maxWidth: 1280,
  margin: '0 auto',
  padding: 'clamp(16px, 4vw, 56px)',
  minWidth: 0,
};
export const title44 = { fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 300, lineHeight: 1.3, color: G.text, display: 'inline-flex', alignItems: 'center', gap: 8 };
export const title22 = { fontSize: 22, fontWeight: 300, lineHeight: 1.3, color: G.text, display: 'inline-flex', alignItems: 'center', gap: 8 };
export const infoDot = { width: 12, height: 12, borderRadius: '50%', background: G.blue, color: 'white', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
export const sectionHeading = { fontSize: 18, fontWeight: 300, color: G.text, margin: '0 0 12px' };
export const segmentTrack = { display: 'inline-flex', background: G.border, borderRadius: 4, padding: 4, gap: 0 };
export const segment = (active) => ({
  padding: '0 18px', height: 22, lineHeight: '22px', fontSize: 14, fontWeight: active ? 700 : 400,
  color: G.text, background: active ? 'white' : 'transparent', border: 'none', borderRadius: 4,
  cursor: 'pointer', fontFamily: G.font, whiteSpace: 'nowrap',
});
export const datePill = { display: 'inline-flex', alignItems: 'center', gap: 6, background: G.border, borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: G.text, position: 'relative', cursor: 'pointer' };
export const roundNav = { ...circleButton, width: 30, height: 30, fontSize: 18, color: G.text };
export const tabRow = { display: 'flex', borderBottom: `1px solid ${G.faint}`, gap: 0 };
export const tab = (active) => ({
  padding: '8px 16px', fontSize: 14, fontWeight: 400, color: active ? G.text : G.muted,
  borderBottom: `1.5px solid ${active ? 'black' : 'transparent'}`, marginBottom: -1, background: 'transparent',
  border: 'none', borderBottomWidth: 1.5, borderBottomStyle: 'solid', borderBottomColor: active ? 'black' : 'transparent',
  cursor: 'pointer', fontFamily: G.font, whiteSpace: 'nowrap', textDecoration: 'none',
});
export const emptyWrap = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 16px' };
export const emptyCircle = { width: 64, height: 64, borderRadius: '50%', background: G.border, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 };
export const emptyTitle = { fontSize: 26, fontWeight: 300, color: G.text, marginBottom: 6 };
export const emptySub = { fontSize: 12, color: G.text, maxWidth: 360, lineHeight: 1.6 };
export const blueButton = { background: G.blue, color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: G.font, textDecoration: 'none', display: 'inline-block', lineHeight: '20px' };
export const grayButton = { ...blueButton, background: G.border, color: G.text };
export const outlinedButton = { ...blueButton, background: 'white', color: G.text, border: `1px solid ${G.faint}`, padding: '7px 15px' };
export const linkText = { color: G.blue, fontSize: 12, textDecoration: 'none', cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: G.font, padding: 0 };
export const statPairValue = { fontSize: 22, fontWeight: 300, color: G.text, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' };
export const statPairLabel = { fontSize: 12, color: G.muted, marginTop: 2 };
export const noticeStrip = { background: G.surface2, border: `1px solid ${G.border}`, borderRadius: 4, padding: '8px 12px', fontSize: 12, color: G.text, display: 'flex', alignItems: 'center', gap: 8 };
export const yellowBanner = { background: '#fff8e1', border: '1px solid #f3e2a8', padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 };
export const kebab = { ...iconButton, fontSize: 18, color: G.muted, padding: '0 6px', lineHeight: 1 };
