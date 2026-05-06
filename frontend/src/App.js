import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DailyView from './pages/DailyView';
import MasterTaskList from './pages/MasterTaskList';
import MonthlyCalendar from './pages/MonthlyCalendar';
import CalendarToast from './components/CalendarToast';
import { todayISO } from './utils/dayInfo';

function TodayRedirect() {
  return <Navigate to={`/day/${todayISO()}`} replace />;
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
