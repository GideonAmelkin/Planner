import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './icons';
import { shiftISO } from '../shared/dayInfo';
import { COLORS } from '../shared/styles';
import { W, roundButton } from './theme';

// The Workout tab's top bar: the tab's mark, a pill per section of the page, and the day controls
// (Prev / Today / Next, the date field) plus the range picker. The page is one scrolling dashboard
// (the user's call, 2026-09-29: "I don't want to toggle, I want to scroll"), so a pill only jumps to
// its section, and the pill of the section on screen is the highlighted one.
export const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'trainer', label: 'Trainer', icon: 'dumbbell' },
];
export const sectionId = (key) => `workout-${key}`;
export const scrollToSection = (key) => {
  const el = document.getElementById(sectionId(key));
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// The section whose top has most recently passed the upper third of the window.
function useCurrentSection() {
  const [current, setCurrent] = useState(SECTIONS[0].key);
  useEffect(() => {
    const pick = () => {
      const line = window.innerHeight / 3;
      let cur = SECTIONS[0].key;
      for (const s of SECTIONS) {
        const el = document.getElementById(sectionId(s.key));
        if (el && el.getBoundingClientRect().top <= line) cur = s.key;
      }
      // At the bottom of the page the last section wins even when it is too short to reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = SECTIONS[SECTIONS.length - 1].key;
      setCurrent(cur);
    };
    pick();
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    return () => { window.removeEventListener('scroll', pick); window.removeEventListener('resize', pick); };
  }, []);
  return current;
}

const navWrap = { display: 'flex', gap: 4, background: 'rgba(255,255,255,.6)', border: `1px solid ${W.glassBorder}`, borderRadius: 999, padding: 4, overflowX: 'auto', maxWidth: '100%' };
const tab = (on) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 999, fontSize: 13, whiteSpace: 'nowrap',
  border: 'none', cursor: 'pointer', font: 'inherit',
  background: on ? '#E7EAF1' : 'transparent', color: on ? COLORS.ink : COLORS.muted, fontWeight: on ? 600 : 400,
});
const chip = { height: 36, borderRadius: 999, border: `1px solid ${COLORS.hairline}`, background: W.glassStrong, padding: '0 14px', display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 500, color: COLORS.ink, textDecoration: 'none', whiteSpace: 'nowrap' };
const dateInput = { ...chip, padding: '0 10px', font: 'inherit', fontSize: 13, colorScheme: 'light' };

export default function WorkoutTopNav({ date, extra = null }) {
  const navigate = useNavigate();
  const current = useCurrentSection();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 17 }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, background: COLORS.paper, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(30,50,110,.1)', color: W.blue }}>
          <Icon name="dumbbell" size={22} />
        </span>
        Workout
      </div>
      <nav aria-label="Workout sections" style={navWrap}>
        {SECTIONS.map((v) => (
          <button key={v.key} type="button" onClick={() => scrollToSection(v.key)} aria-current={current === v.key ? 'location' : undefined} style={tab(current === v.key)}>
            <Icon name={v.icon} size={15} />{v.label}
          </button>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Link to={`/workout/${shiftISO(date, -1)}`} style={roundButton()} title="Previous day" aria-label="Previous day"><Icon name="left" /></Link>
        <Link to={`/workout/today`} style={chip}>Today</Link>
        <Link to={`/workout/${shiftISO(date, 1)}`} style={roundButton()} title="Next day" aria-label="Next day"><Icon name="right" /></Link>
        <input type="date" value={date} aria-label="Date" onChange={(e) => { if (e.target.value) navigate(`/workout/${e.target.value}`); }} style={dateInput} />
        {extra}
      </div>
    </div>
  );
}
