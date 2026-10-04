import React from 'react';
import { useParams } from 'react-router-dom';
import api from './api';
import { notifyTodayChange, onTodayChange, setServerDay, todayEndsAt, todayISO } from './dayInfo';

// The literal path segment that means "whatever day it is now": /agenda/today.
export const TODAY = 'today';
const REFRESH_MS = 10 * 60 * 1000;

// Ask the server what day it is (on load, focus, the tab shown again, every 10 minutes)
// and turn the page over at the day's end. Mounted once in App.
export function ServerClock() {
  React.useEffect(() => {
    let alive = true;
    let midnight = null;
    const armMidnight = () => {
      clearTimeout(midnight);
      // At the end of the day re-render every subscriber, then ask the server again.
      midnight = setTimeout(() => { notifyTodayChange(); fetchDay(); armMidnight(); }, Math.max(1000, todayEndsAt() - Date.now() + 500));
    };
    const fetchDay = () => api.get('/today')
      .then((r) => { if (alive) { setServerDay(r.data); armMidnight(); } })
      .catch(() => { /* offline: the browser's day stands in */ });
    const onVisible = () => { if (!document.hidden) fetchDay(); };

    fetchDay();
    armMidnight();
    const every = setInterval(fetchDay, REFRESH_MS);
    window.addEventListener('focus', fetchDay);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(midnight);
      clearInterval(every);
      window.removeEventListener('focus', fetchDay);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}

// Today as state: re-renders the caller when the day turns.
export function useToday() {
  const [today, setToday] = React.useState(todayISO);
  React.useEffect(() => {
    const update = () => setToday(todayISO());
    update();
    return onTodayChange(update);
  }, []);
  return today;
}

// The page's date: the :date param, with /<section>/today resolved to the current day.
export function useViewDate() {
  const { date } = useParams();
  const today = useToday();
  return date === TODAY ? today : date;
}
