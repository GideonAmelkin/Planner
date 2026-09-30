import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './icons';
import { shiftISO, todayISO } from '../shared/dayInfo';
import { COLORS } from '../shared/styles';
import { W, roundButton } from './theme';

// The Workout tab's top bar: the tab's mark, the four views as a pill nav, and the day controls
// (Prev / Today / Next, the date field) plus whatever the view adds (the range picker).
// Day links keep the current view.
export const VIEWS = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'trainer', label: 'Trainer', icon: 'dumbbell' },
  { key: 'workouts', label: 'Workouts', icon: 'list' },
  { key: 'log', label: 'Log', icon: 'log' },
];

const navWrap = { display: 'flex', gap: 4, background: 'rgba(255,255,255,.6)', border: `1px solid ${W.glassBorder}`, borderRadius: 999, padding: 4, overflowX: 'auto', maxWidth: '100%' };
const tab = (on) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 999, fontSize: 13, whiteSpace: 'nowrap',
  border: 'none', cursor: 'pointer', font: 'inherit',
  background: on ? '#E7EAF1' : 'transparent', color: on ? COLORS.ink : COLORS.muted, fontWeight: on ? 600 : 400,
});
const chip = { height: 36, borderRadius: 999, border: `1px solid ${COLORS.hairline}`, background: W.glassStrong, padding: '0 14px', display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 500, color: COLORS.ink, textDecoration: 'none', whiteSpace: 'nowrap' };
const dateInput = { ...chip, padding: '0 10px', font: 'inherit', fontSize: 13, colorScheme: 'light' };

export default function WorkoutTopNav({ date, view, onView, extra = null }) {
  const navigate = useNavigate();
  const q = view === 'overview' ? '' : `?view=${view}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 17 }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, background: COLORS.paper, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(30,50,110,.1)', color: W.blue }}>
          <Icon name="dumbbell" size={22} />
        </span>
        Workout
      </div>
      <nav aria-label="Workout views" style={navWrap}>
        {VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => onView(v.key)} aria-current={view === v.key ? 'page' : undefined} style={tab(view === v.key)}>
            <Icon name={v.icon} size={15} />{v.label}
          </button>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Link to={`/workout/${shiftISO(date, -1)}${q}`} style={roundButton()} title="Previous day" aria-label="Previous day"><Icon name="left" /></Link>
        <Link to={`/workout/${todayISO()}${q}`} style={chip}>Today</Link>
        <Link to={`/workout/${shiftISO(date, 1)}${q}`} style={roundButton()} title="Next day" aria-label="Next day"><Icon name="right" /></Link>
        <input type="date" value={date} aria-label="Date" onChange={(e) => { if (e.target.value) navigate(`/workout/${e.target.value}${q}`); }} style={dateInput} />
        {extra}
      </div>
    </div>
  );
}
