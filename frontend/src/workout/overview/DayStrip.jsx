import React, { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../icons';
import { groupOf } from '../muscles';
import { COLORS } from '../../shared/styles';
import { W, glassCard, roundButton } from '../theme';

// The Overview's bottom strip: one slot per day (seven Sunday-start weeks ending with the shown
// day's week), the month name over each month's first slot, a dumbbell tinted with the main muscle
// group on gym days, a house on home days, a dot on rest days. The range's last seven days sit on a
// white band; the shown day's number is the indigo pill. A day opens that date on this view.
const SLOT = 40;
const monthName = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long' });
const longDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function DayStrip({ days, date, bandStart, bandEnd }) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  // Open scrolled so the shown day sits near the right edge with a few days after it.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const i = days.findIndex((d) => d.date === date);
    if (el && i >= 0) el.scrollLeft = Math.max(0, (i + 1) * SLOT - el.clientWidth + 4 * SLOT);
  }, [days, date]);
  const page = (dir) => { const el = scrollRef.current; if (el) el.scrollBy({ left: dir * 7 * SLOT, behavior: 'smooth' }); };

  return (
    <div style={{ ...glassCard, padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" style={roundButton()} aria-label="Earlier days" onClick={() => page(-1)}><Icon name="left" /></button>
      <div ref={scrollRef} style={{ overflowX: 'auto', flex: 1, minWidth: 0, scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', width: 'max-content', paddingTop: 16 }}>
          {days.map((d, i) => {
            const band = d.date >= bandStart && d.date <= bandEnd;
            const first = band && (i === 0 || days[i - 1].date < bandStart);
            const last = band && (i === days.length - 1 || days[i + 1].date > bandEnd);
            const sel = d.date === date;
            const color = d.kind === 'gym' ? (d.muscle ? groupOf(d.muscle).color : COLORS.workout) : W.blue;
            const what = d.kind === 'gym' ? `gym${d.muscle ? `, mostly ${groupOf(d.muscle).label.toLowerCase()}` : ''}` : d.kind === 'home' ? 'home' : 'rest day';
            const showNum = d.kind || sel || new Date(`${d.date}T12:00:00`).getDay() === 0;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => navigate(`/workout/${d.date}`)}
                title={`${longDay(d.date)}: ${what}${d.sessions.length > 1 ? ` (${d.sessions.length} workouts)` : ''}`}
                aria-current={sel ? 'date' : undefined}
                style={{
                  width: SLOT, flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  border: 'none', cursor: 'pointer', font: 'inherit', padding: '4px 0',
                  background: band ? 'rgba(255,255,255,.95)' : 'transparent',
                  borderRadius: first && last ? 16 : first ? '16px 0 0 16px' : last ? '0 16px 16px 0' : 0,
                }}
              >
                {d.date.slice(8) === '01' || i === 0 ? <span style={{ position: 'absolute', top: -16, left: 4, fontSize: 10, color: COLORS.muted, whiteSpace: 'nowrap' }}>{monthName(d.date)}</span> : null}
                {d.kind ? (
                  <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, color }}>
                    <Icon name={d.kind === 'gym' ? 'dumbbell' : 'home'} size={15} />
                  </span>
                ) : <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLORS.faint, margin: '12px 0' }} />}
                <span style={{
                  fontSize: 11, fontVariantNumeric: 'tabular-nums', lineHeight: '16px',
                  color: sel ? '#FFFFFF' : COLORS.muted, background: sel ? COLORS.accent : 'transparent', borderRadius: 999, padding: '0 5px',
                }}>{showNum ? Number(d.date.slice(8)) : ' '}</span>
              </button>
            );
          })}
        </div>
      </div>
      <button type="button" style={roundButton()} aria-label="Later days" onClick={() => page(1)}><Icon name="right" /></button>
    </div>
  );
}
