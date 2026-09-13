import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import DailyView from './pages/DailyView';
import CalendarToast from './components/CalendarToast';
import { todayISO } from './utils/dayInfo';

function TodayRedirect() {
  return <Navigate to={`/day/${todayISO()}`} replace />;
}

// On fresh page load (reload, new tab, bookmark), snap any /day/:date URL
// back to today. SPA navigation within the session is unaffected.
function BootRedirectToToday() {
  const navigate = useNavigate();
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const m = window.location.pathname.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
    if (m && m[1] !== todayISO()) {
      navigate(`/day/${todayISO()}`, { replace: true });
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
        <Route path="/day/:date" element={<DailyView />} />
        <Route path="*" element={<TodayRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
