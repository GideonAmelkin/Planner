import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import AgendaView from './agenda/AgendaView';
import GarminView from './garmin/GarminView';
import WorkoutView from './workout/WorkoutView';
import SocialView from './social/SocialView';
import HealthView from './health/HealthView';
import CalendarToast from './shared/CalendarToast';
import { todayISO, isoToDate, dateToISO } from './shared/dayInfo';
import { ServerClock, TODAY, useToday } from './shared/today';
import { reportClientEvent } from './shared/clientEvent';

// The top-level tabs, each with its own /<section>/:date route.
export const SECTIONS = ['agenda', 'garmin', 'workout', 'social', 'health'];

function TodayRedirect() {
  return <Navigate to={`/agenda/${TODAY}`} replace />;
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

// Guards a /<section>/:date page. /<section>/today is today, always; a dated URL that
// names today becomes /<section>/today (so the address bar never pins today's date and a
// reopened or restored tab can not stay on an old day); a malformed date lands on today
// instead of throwing inside the date helpers and blanking the app.
function Dated({ section, children }) {
  const { date } = useParams();
  const { pathname } = useLocation();
  const today = useToday();
  if (date === TODAY) return children;
  if (!isValidISO(date)) return <Navigate to={`/${section}/${TODAY}`} replace />;
  if (date === today) return <Navigate to={pathname.replace(`/${date}`, `/${TODAY}`)} replace />;
  return children;
}

// Legacy /day/:date links (bookmarks, old calendar links) land on the agenda.
function LegacyDayRedirect() {
  const { date } = useParams();
  return <Navigate to={`/agenda/${isValidISO(date) ? date : TODAY}`} replace />;
}

// The Garmin tab lived at /health until 2026-09-27. Its sub-page URLs redirect for
// good (bookmarks, old calendar chips); bare /health/:date is the Health tab now.
function HealthToGarmin() {
  const { date, page, id } = useParams();
  const d = isValidISO(date) || date === TODAY ? date : TODAY;
  return <Navigate to={id ? `/garmin/${d}/activity/${id}` : `/garmin/${d}/${page}`} replace />;
}

// A dated tab URL: section, date, optional sub-page (/garmin/:date/sleep, /garmin/:date/activity/:id).
const DATED_PATH = /^\/(agenda|garmin|health|workout|social)\/(\d{4}-\d{2}-\d{2}|today)(\/[\w-]+(\/\d+)?)?$/;
// How long the app must go untouched (no click, key, scroll or mouse movement; tab
// hidden; machine asleep) before it moves back to today.
const AWAY_MS = 10 * 60 * 1000;
const LAST_ACTIVE_KEY = 'planner.lastActive';
// Mouse movement and scrolling fire constantly; record them at most this often.
const ACTIVE_THROTTLE_MS = 5 * 1000;
// A new build reloads an open tab only after this long without input, so nothing typed is lost.
const RELOAD_IDLE_MS = 60 * 1000;
const RELOADED_FOR_KEY = 'planner.reloadedFor';
// A tab sitting on another day reports that to the trail at most this often.
const DATED_REPORT_MS = 60 * 60 * 1000;
const BUNDLE_PATH = /\/static\/js\/main\.\w+\.js/;

// The current URL moved to today (/<section>/today) in the same section, keeping the sub-page.
function todayPath() {
  const m = window.location.pathname.match(DATED_PATH);
  return m ? `/${m[1]}/${TODAY}${m[3] || ''}` : window.location.pathname;
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
      reportClientEvent('reload', { served: served.replace(/^.*\/static\/js\//, ''), to: todayPath() });
      window.location.replace(todayPath());
    })
    .catch(() => { /* offline: try again next time */ });
}

// Opening or returning to the app lands on today in the current section, keeping the
// sub-page. "Returning" is judged by the last real interaction (click, key, scroll, mouse
// movement, focus, the tab shown again), kept in sessionStorage, never by timers or
// visibility alone: a Chrome window left on screen behind other apps is not "hidden", so
// nothing but the user's own input may count as being there. A minute tick moves an idle
// tab to today once it has gone AWAY_MS untouched, after the machine slept, or at midnight,
// so the window already shows today when the user looks at it. Browsing other days with
// Prev / Next is interaction, so a tab in use is never yanked away.
function SnapToToday() {
  const navigate = useNavigate();
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;
  React.useEffect(() => {
    const snap = (reason) => {
      const from = window.location.pathname;
      const path = todayPath();
      if (path === from) return;
      const last = readLastActive();
      reportClientEvent('snap', { reason, from, to: path, idleSec: last ? Math.round((Date.now() - last) / 1000) : undefined });
      navigateRef.current(path, { replace: true });
    };
    const readLastActive = () => {
      try { return Number(sessionStorage.getItem(LAST_ACTIVE_KEY)) || 0; } catch (_) { return 0; }
    };
    const writeLastActive = (v) => {
      try { sessionStorage.setItem(LAST_ACTIVE_KEY, String(v)); } catch (_) { /* ignore */ }
    };
    const isAway = (last, now) => !last || now - last >= AWAY_MS || dateToISO(new Date(last)) !== dateToISO(new Date(now));
    // The away period already handled by the tick, so an idle tab checks the bundle once.
    let handledFor = 0;
    const comeBack = (reason) => {
      snap(reason);
      reloadIfNewBundle();
    };

    // The user is here (focus, click, key, shown again): snap first if they had been away.
    const active = () => {
      const now = Date.now();
      const last = readLastActive();
      if (isAway(last, now) && handledFor !== last) comeBack('return');
      handledFor = 0;
      writeLastActive(now);
    };
    // Mouse movement and scrolling: same, but at most one storage write per throttle window.
    let lastMove = 0;
    const moved = () => {
      const now = Date.now();
      if (now - lastMove < ACTIVE_THROTTLE_MS) return;
      lastMove = now;
      active();
    };

    reportClientEvent('load', { from: window.location.pathname, to: todayPath() });
    snap('load');
    writeLastActive(Date.now());

    const onVisibility = () => { if (!document.hidden) active(); };
    const onPageShow = (e) => { if (e.persisted) active(); };
    // Every minute while visible. Never counts as interaction. A gap of AWAY_MS since the
    // previous tick means the machine slept or the tab was frozen. Every tick also looks
    // for a new build once the user has been idle a minute, so a fix reaches an open tab
    // without anyone reloading it.
    let lastTick = Date.now();
    let datedReportedAt = 0;
    let tickDay = todayISO();
    const tick = setInterval(() => {
      const now = Date.now();
      const slept = now - lastTick >= AWAY_MS;
      const newDay = todayISO() !== tickDay;
      lastTick = now;
      tickDay = todayISO();
      if (document.hidden) return;
      const last = readLastActive();
      if (slept || newDay || (isAway(last, now) && handledFor !== last)) {
        comeBack(slept ? 'slept' : newDay ? 'new-day' : 'idle');
        handledFor = last;
      } else if (now - last >= RELOAD_IDLE_MS) {
        reloadIfNewBundle();
      }
      if (todayPath() !== window.location.pathname && now - datedReportedAt >= DATED_REPORT_MS) {
        datedReportedAt = now;
        reportClientEvent('on-other-day', { idleSec: Math.round((now - last) / 1000) });
      }
    }, 60 * 1000);

    const opts = { capture: true, passive: true };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', active);
    window.addEventListener('pointerdown', active, opts);
    window.addEventListener('keydown', active, opts);
    window.addEventListener('mousemove', moved, opts);
    window.addEventListener('wheel', moved, opts);
    window.addEventListener('scroll', moved, opts);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', active);
      window.removeEventListener('pointerdown', active, opts);
      window.removeEventListener('keydown', active, opts);
      window.removeEventListener('mousemove', moved, opts);
      window.removeEventListener('wheel', moved, opts);
      window.removeEventListener('scroll', moved, opts);
      clearInterval(tick);
    };
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ServerClock />
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
