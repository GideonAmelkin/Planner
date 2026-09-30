import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import AgendaView from './agenda/AgendaView';
import GarminView from './garmin/GarminView';
import WorkoutView from './workout/WorkoutView';
import SocialView from './social/SocialView';
import HealthView from './health/HealthView';
import CalendarToast from './shared/CalendarToast';
import { todayISO, isoToDate, dateToISO } from './shared/dayInfo';

// The top-level tabs, each with its own /<section>/:date route.
export const SECTIONS = ['agenda', 'garmin', 'workout', 'social', 'health'];

function TodayRedirect() {
  return <Navigate to={`/agenda/${todayISO()}`} replace />;
}

// A real calendar date in YYYY-MM-DD form ('2026-09-26.' and '2026-13-40' are not).
function isValidISO(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  try {
    return dateToISO(isoToDate(date)) === date;
  } catch (_) {
    return false;
  }
}

// Guards a /<section>/:date page: a malformed date lands on today in that section
// instead of throwing inside the date helpers and blanking the app.
function Dated({ section, children }) {
  const { date } = useParams();
  if (!isValidISO(date)) return <Navigate to={`/${section}/${todayISO()}`} replace />;
  return children;
}

// Legacy /day/:date links (bookmarks, old calendar links) land on the agenda.
function LegacyDayRedirect() {
  const { date } = useParams();
  return <Navigate to={`/agenda/${isValidISO(date) ? date : todayISO()}`} replace />;
}

// The Garmin tab lived at /health until 2026-09-27. Its sub-page URLs redirect for
// good (bookmarks, old calendar chips); bare /health/:date is the Health tab now.
function HealthToGarmin() {
  const { date, page, id } = useParams();
  const d = isValidISO(date) ? date : todayISO();
  return <Navigate to={id ? `/garmin/${d}/activity/${id}` : `/garmin/${d}/${page}`} replace />;
}

// A dated tab URL: section, date, optional sub-page (/garmin/:date/sleep, /garmin/:date/activity/:id).
const DATED_PATH = /^\/(agenda|garmin|health|workout|social)\/(\d{4}-\d{2}-\d{2})(\/[\w-]+(\/\d+)?)?$/;
// How long the app must go unseen (tab hidden, window idle, machine asleep) before
// coming back lands on today.
const AWAY_MS = 10 * 60 * 1000;
const LAST_SEEN_KEY = 'planner.lastSeen';
const RELOADED_FOR_KEY = 'planner.reloadedFor';
const BUNDLE_PATH = /\/static\/js\/main\.\w+\.js/;

// The current URL moved to today in the same section, keeping the sub-page.
function todayPath() {
  const m = window.location.pathname.match(DATED_PATH);
  return m ? `/${m[1]}/${todayISO()}${m[3] || ''}` : window.location.pathname;
}

// After a deploy, a tab left open keeps running the old bundle. Compare the served
// index.html with the loaded script and reload onto today when they differ (once per hash).
function reloadIfNewBundle() {
  const loaded = Array.from(document.scripts).map((s) => s.src).find((src) => BUNDLE_PATH.test(src));
  if (!loaded) return;
  fetch('/index.html', { cache: 'no-store' })
    .then((r) => (r.ok ? r.text() : ''))
    .then((html) => {
      const served = (html.match(BUNDLE_PATH) || [])[0];
      if (!served || loaded.endsWith(served)) return;
      try {
        if (sessionStorage.getItem(RELOADED_FOR_KEY) === served) return;
        sessionStorage.setItem(RELOADED_FOR_KEY, served);
      } catch (_) { /* ignore */ }
      window.location.replace(todayPath());
    })
    .catch(() => { /* offline: try again next time */ });
}

// Opening or returning to the app lands on today in the current section, keeping the
// sub-page. "Returning" is judged by time, not by events, because a sleeping Mac or a
// window left on screen never fires visibilitychange: the tab remembers when it was last
// seen (every minute while visible, on any click or key, when hidden), and the next look
// snaps when that was AWAY_MS or more ago or on an earlier calendar day. Browsing other
// days with Prev / Next keeps the tab "seen", so it is never yanked away mid-use.
function SnapToToday() {
  const navigate = useNavigate();
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;
  React.useEffect(() => {
    const snap = () => {
      const path = todayPath();
      if (path !== window.location.pathname) navigateRef.current(path, { replace: true });
    };
    const readLastSeen = () => {
      try { return Number(sessionStorage.getItem(LAST_SEEN_KEY)) || 0; } catch (_) { return 0; }
    };
    const writeLastSeen = (v) => {
      try { sessionStorage.setItem(LAST_SEEN_KEY, String(v)); } catch (_) { /* ignore */ }
    };
    // A look at the app: snap (and pick up a new deploy) if it has been away, then mark it seen.
    const look = () => {
      const now = Date.now();
      const last = readLastSeen();
      writeLastSeen(now);
      if (last && (now - last >= AWAY_MS || dateToISO(new Date(last)) !== todayISO())) {
        snap();
        reloadIfNewBundle();
      }
    };

    snap();
    writeLastSeen(Date.now());

    const onVisibility = () => {
      if (document.hidden) writeLastSeen(Date.now());
      else look();
    };
    const onPageShow = (e) => { if (e.persisted) look(); };
    // Runs every minute while visible; a gap of AWAY_MS since the last tick means the
    // machine slept or the tab was frozen, and midnight counts as a new day.
    const tick = setInterval(() => { if (!document.hidden) look(); }, 60 * 1000);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', look);
    window.addEventListener('pointerdown', look, true);
    window.addEventListener('keydown', look, true);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', look);
      window.removeEventListener('pointerdown', look, true);
      window.removeEventListener('keydown', look, true);
      clearInterval(tick);
    };
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <SnapToToday />
      <CalendarToast />
      <Routes>
        <Route path="/" element={<TodayRedirect />} />
        <Route path="/agenda/:date" element={<Dated section="agenda"><AgendaView /></Dated>} />
        <Route path="/garmin/:date" element={<Dated section="garmin"><GarminView /></Dated>} />
        <Route path="/garmin/:date/:page" element={<Dated section="garmin"><GarminView /></Dated>} />
        <Route path="/garmin/:date/activity/:id" element={<Dated section="garmin"><GarminView /></Dated>} />
        <Route path="/health/:date" element={<Dated section="health"><HealthView /></Dated>} />
        <Route path="/health/:date/:page" element={<HealthToGarmin />} />
        <Route path="/health/:date/activity/:id" element={<HealthToGarmin />} />
        <Route path="/workout/:date" element={<Dated section="workout"><WorkoutView /></Dated>} />
        <Route path="/social/:date" element={<Dated section="social"><SocialView /></Dated>} />
        <Route path="/day/:date" element={<LegacyDayRedirect />} />
        <Route path="*" element={<TodayRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
