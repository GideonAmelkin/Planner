import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import DailyView from './pages/DailyView';
import HealthView from './pages/HealthView';
import WorkoutView from './pages/WorkoutView';
import CalendarToast from './components/CalendarToast';
import { todayISO, isoToDate, dateToISO } from './utils/dayInfo';

// Three top-level tabs, each with its own /<section>/:date route.
export const SECTIONS = ['agenda', 'health', 'workout'];

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

// On fresh page load (reload, new tab, bookmark), snap any /<section>/:date URL
// back to today in that section. SPA navigation within the session is unaffected.
function BootRedirectToToday() {
  const navigate = useNavigate();
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const m = window.location.pathname.match(/^\/(agenda|health|workout)\/(\d{4}-\d{2}-\d{2})$/);
    if (m && m[2] !== todayISO()) {
      navigate(`/${m[1]}/${todayISO()}`, { replace: true });
    }
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <BootRedirectToToday />
      <CalendarToast />
      <Routes>
        <Route path="/" element={<TodayRedirect />} />
        <Route path="/agenda/:date" element={<Dated section="agenda"><DailyView /></Dated>} />
        <Route path="/health/:date" element={<Dated section="health"><HealthView /></Dated>} />
        <Route path="/workout/:date" element={<Dated section="workout"><WorkoutView /></Dated>} />
        <Route path="/day/:date" element={<LegacyDayRedirect />} />
        <Route path="*" element={<TodayRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
