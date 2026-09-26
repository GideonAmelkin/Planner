import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import DailyView from './pages/DailyView';
import HealthView from './pages/HealthView';
import CalendarToast from './components/CalendarToast';
import { todayISO } from './utils/dayInfo';

// Two top-level tabs, each with its own /<section>/:date route.
export const SECTIONS = ['agenda', 'health'];

function TodayRedirect() {
  return <Navigate to={`/agenda/${todayISO()}`} replace />;
}

// Legacy /day/:date links (bookmarks, old calendar links) land on the agenda.
function LegacyDayRedirect() {
  const { date } = useParams();
  return <Navigate to={`/agenda/${date}`} replace />;
}

// On fresh page load (reload, new tab, bookmark), snap any /<section>/:date URL
// back to today in that section. SPA navigation within the session is unaffected.
function BootRedirectToToday() {
  const navigate = useNavigate();
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const m = window.location.pathname.match(/^\/(agenda|health)\/(\d{4}-\d{2}-\d{2})$/);
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
        <Route path="/agenda/:date" element={<DailyView />} />
        <Route path="/health/:date" element={<HealthView />} />
        <Route path="/day/:date" element={<LegacyDayRedirect />} />
        <Route path="*" element={<TodayRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
