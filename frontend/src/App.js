import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import DailyView from './pages/DailyView';
import MasterTaskList from './pages/MasterTaskList';
import MonthlyCalendar from './pages/MonthlyCalendar';
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

function MasterRedirect() {
  const now = new Date();
  return <Navigate to={`/master/${now.getFullYear()}/${now.getMonth() + 1}`} replace />;
}

function CalendarRedirect() {
  const now = new Date();
  return <Navigate to={`/calendar/${now.getFullYear()}/${now.getMonth() + 1}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <BootRedirectToToday />
      <CalendarToast />
      <Routes>
        <Route path="/" element={<TodayRedirect />} />
        <Route path="/day/:date" element={<DailyView />} />
        <Route path="/master" element={<MasterRedirect />} />
        <Route path="/master/:year/:month" element={<MasterTaskList />} />
        <Route path="/calendar" element={<CalendarRedirect />} />
        <Route path="/calendar/:year/:month" element={<MonthlyCalendar />} />
        <Route path="*" element={<TodayRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
