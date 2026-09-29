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
// How long the tab must sit in the background before coming back lands on today.
const AWAY_MS = 10 * 60 * 1000;
const HIDDEN_AT_KEY = 'planner.hiddenAt';

// Opening or returning to the app lands on today in the current section, keeping the
// sub-page: on page load, on a back-forward cache restore, when the tab comes back after
// AWAY_MS in the background, and at midnight when the tab was showing the old today.
// Prev / Next and the date field inside a tab are unaffected, so other days stay browsable.
function SnapToToday() {
  const navigate = useNavigate();
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;
  React.useEffect(() => {
    const snap = () => {
      const m = window.location.pathname.match(DATED_PATH);
      if (m && m[2] !== todayISO()) {
        navigateRef.current(`/${m[1]}/${todayISO()}${m[3] || ''}`, { replace: true });
      }
    };
    const readHiddenAt = () => {
      try { return Number(sessionStorage.getItem(HIDDEN_AT_KEY)) || 0; } catch (_) { return 0; }
    };
    const writeHiddenAt = (v) => {
      try {
        if (v) sessionStorage.setItem(HIDDEN_AT_KEY, String(v));
        else sessionStorage.removeItem(HIDDEN_AT_KEY);
      } catch (_) { /* ignore */ }
    };

    snap();
    writeHiddenAt(document.hidden ? Date.now() : 0);

    const onVisibility = () => {
      if (document.hidden) { writeHiddenAt(Date.now()); return; }
      const hiddenAt = readHiddenAt();
      writeHiddenAt(0);
      if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) snap();
    };
    const onPageShow = (e) => { if (e.persisted) snap(); };
    let lastToday = todayISO();
    const tick = setInterval(() => {
      const today = todayISO();
      if (today === lastToday) return;
      const m = window.location.pathname.match(DATED_PATH);
      if (m && m[2] === lastToday) snap();
      lastToday = today;
    }, 60 * 1000);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
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
