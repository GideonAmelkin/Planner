import React, { useEffect, useRef, useState } from 'react';
import { createAppointment, updateAppointment, deleteAppointment } from '../services/api';

const START_HOUR = 7;
const END_HOUR = 20;          // 8 PM marker
const HOURS = END_HOUR - START_HOUR; // 13
const PX_PER_HOUR = 60;

const PROVIDER_STYLES = {
  google:  { bar: '#1565C0', bg: '#E3F2FD', text: '#0D3B66' },
  outlook: { bar: '#00695C', bg: '#E0F2F1', text: '#003D33' },
  manual:  { bar: '#2D3436', bg: '#FBF6E7', text: '#2D3436' },
};

function pad(n) { return String(n).padStart(2, '0'); }

function hourLabel(h) {
  if (h === 12) return '12';
  return String(h > 12 ? h - 12 : h);
}

function hoursMinutes(iso) {
  if (!iso) return null;
  const m = String(iso).match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function fractionalHour(iso) {
  const t = hoursMinutes(iso);
  if (!t) return null;
  return t.h + t.m / 60;
}

function formatTimeRange(startIso, endIso) {
  const s = hoursMinutes(startIso);
  const e = hoursMinutes(endIso);
  if (!s) return '';
  const fmt = (t) => {
    if (!t) return '';
    const ampm = t.h >= 12 ? 'PM' : 'AM';
    const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
    return `${h12}:${pad(t.m)} ${ampm}`;
  };
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

// Greedy column-packing: events that overlap go into separate columns within
// the same time band. Returns events with `column` and `columnsInBand`.
function layoutOverlaps(events) {
  const sorted = [...events].sort((a, b) =>
    String(a.start_at).localeCompare(String(b.start_at))
  );
  const placed = [];
  let band = [];
  let bandEnd = -Infinity;

  const flushBand = () => {
    if (band.length === 0) return;
    const cols = band.reduce((m, x) => Math.max(m, x.column + 1), 0);
    for (const x of band) x.columnsInBand = cols;
    band = [];
    bandEnd = -Infinity;
  };

  for (const ev of sorted) {
    const start = fractionalHour(ev.start_at);
    const end = Math.max(start + 0.25, fractionalHour(ev.end_at) || start + 0.5);
    if (start >= bandEnd) flushBand();
    // assign smallest unused column index in current band
    const used = new Set(band.filter((x) => x._end > start).map((x) => x.column));
    let col = 0;
    while (used.has(col)) col++;
    const item = { ...ev, _start: start, _end: end, column: col, columnsInBand: 1 };
    band.push(item);
    bandEnd = Math.max(bandEnd, end);
    placed.push(item);
  }
  flushBand();
  return placed;
}

function buildIso(dateISO, h, m) {
  return `${dateISO}T${pad(h)}:${pad(m)}`;
}

function snap15(minutes) {
  return Math.round(minutes / 15) * 15;
}

function ManualEditor({ block, dateISO, onSave, onDelete, onCancel }) {
  const [text, setText] = useState(block.text);
  const [start, setStart] = useState(() => {
    const t = hoursMinutes(block.start_at) || { h: 9, m: 0 };
    return `${pad(t.h)}:${pad(t.m)}`;
  });
  const [end, setEnd] = useState(() => {
    const t = hoursMinutes(block.end_at) || { h: 10, m: 0 };
    return `${pad(t.h)}:${pad(t.m)}`;
  });

  const submit = async () => {
    const sm = start.match(/^(\d{2}):(\d{2})$/);
    const em = end.match(/^(\d{2}):(\d{2})$/);
    if (!sm || !em || !text.trim()) return;
    const startIso = buildIso(dateISO, Number(sm[1]), Number(sm[2]));
    const endIso = buildIso(dateISO, Number(em[1]), Number(em[2]));
    onSave({ start_at: startIso, end_at: endIso, text: text.trim() });
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '70px 70px 1fr auto',
      gap: 6,
      alignItems: 'center',
      padding: '4px 6px',
      background: 'white',
      border: '1px solid #2D3436',
      borderRadius: 3,
    }}>
      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} step="900"
        style={{ fontSize: 12, padding: '2px 4px', border: '1px solid #C9BB9A' }} />
      <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} step="900"
        style={{ fontSize: 12, padding: '2px 4px', border: '1px solid #C9BB9A' }} />
      <input
        autoFocus
        value={text}
        placeholder="Title"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') onCancel();
        }}
        style={{ fontSize: 13, padding: '4px 6px', border: '1px solid #C9BB9A' }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={submit} style={btnStyle()}>Save</button>
        {block.id ? <button onClick={onDelete} style={btnStyle('#C62828')}>Delete</button> : null}
        <button onClick={onCancel} style={btnStyle('#6B5B40')}>Cancel</button>
      </div>
    </div>
  );
}

function btnStyle(color = '#2D3436') {
  return {
    border: `1px solid ${color}`,
    background: 'white',
    color,
    fontSize: 11,
    padding: '3px 8px',
    cursor: 'pointer',
    borderRadius: 2,
    fontWeight: 600,
    letterSpacing: 0.3,
  };
}

function ExternalBlock({ ev, top, height, leftPct, widthPct }) {
  const style = PROVIDER_STYLES[ev.provider] || PROVIDER_STYLES.manual;
  const handleClick = () => {
    if (ev.link) window.open(ev.link, '_blank', 'noopener');
  };
  return (
    <div
      onClick={handleClick}
      title={ev.title}
      style={{
        position: 'absolute',
        top, height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: style.bg,
        borderLeft: `3px solid ${style.bar}`,
        color: style.text,
        padding: '3px 6px',
        fontSize: 12,
        overflow: 'hidden',
        cursor: ev.link ? 'pointer' : 'default',
        borderRadius: 2,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
        {ev.title}
      </div>
      <div style={{ fontSize: 10, opacity: 0.8 }}>{formatTimeRange(ev.start_at, ev.end_at)}</div>
      {ev.location && height > 50 ? (
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{ev.location}</div>
      ) : null}
    </div>
  );
}

function ManualBlock({ appt, top, height, leftPct, widthPct, onClick }) {
  const style = PROVIDER_STYLES.manual;
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        top, height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: style.bg,
        borderLeft: `3px solid ${style.bar}`,
        color: style.text,
        padding: '3px 6px',
        fontSize: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        borderRadius: 2,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
        {appt.text}
      </div>
      <div style={{ fontSize: 10, opacity: 0.7 }}>{formatTimeRange(appt.start_at, appt.end_at)}</div>
    </div>
  );
}

function AllDayPills({ events }) {
  if (events.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 4px', borderBottom: '1px dashed #C9BB9A' }}>
      <span style={{ fontSize: 11, color: '#6B5B40', alignSelf: 'center', marginRight: 4 }}>All-day:</span>
      {events.map((ev) => {
        const s = PROVIDER_STYLES[ev.provider] || PROVIDER_STYLES.manual;
        return (
          <a key={ev.id}
            href={ev.link || undefined}
            target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 11,
              padding: '2px 8px',
              background: s.bg,
              color: s.text,
              borderLeft: `3px solid ${s.bar}`,
              borderRadius: 2,
              textDecoration: 'none',
            }}>
            {ev.title}
          </a>
        );
      })}
    </div>
  );
}

export default function TimelineSchedule({ dateISO, appointments, externalEvents, calendarErrors, onChange }) {
  const [editing, setEditing] = useState(null); // { mode: 'new'|'edit', block }
  const containerRef = useRef(null);

  useEffect(() => { setEditing(null); }, [dateISO]);

  const externals = (externalEvents || []).filter((e) => !e.all_day);
  const allDay = (externalEvents || []).filter((e) => e.all_day);

  // Build manual blocks with same shape as externals for layout.
  const manualBlocks = appointments
    .filter((a) => a.start_at && a.end_at)
    .map((a) => ({
      id: a.id,
      provider: 'manual',
      start_at: a.start_at,
      end_at: a.end_at,
      title: a.text,
      _appt: a,
    }));

  const allBlocks = [...externals, ...manualBlocks];
  const laidOut = layoutOverlaps(allBlocks);

  const handleEmptyClick = (e) => {
    if (editing) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = Math.max(0, (y / PX_PER_HOUR) * 60);
    const startMinutes = snap15(minutesFromStart);
    const startH = START_HOUR + Math.floor(startMinutes / 60);
    const startM = startMinutes % 60;
    if (startH >= END_HOUR) return;
    const endTotal = startMinutes + 60;
    const endH = Math.min(END_HOUR, START_HOUR + Math.floor(endTotal / 60));
    const endM = endTotal % 60;
    setEditing({
      mode: 'new',
      block: {
        text: '',
        start_at: buildIso(dateISO, startH, startM),
        end_at: buildIso(dateISO, endH, endM),
      },
    });
  };

  const handleSaveNew = async (payload) => {
    const created = await createAppointment({ date: dateISO, ...payload });
    onChange([...appointments, created]);
    setEditing(null);
  };

  const handleSaveEdit = async (payload) => {
    const id = editing.block.id;
    const updated = await updateAppointment(id, payload);
    onChange(appointments.map((x) => x.id === id ? updated : x));
    setEditing(null);
  };

  const handleDelete = async () => {
    const id = editing.block.id;
    await deleteAppointment(id);
    onChange(appointments.filter((x) => x.id !== id));
    setEditing(null);
  };

  return (
    <div>
      <div style={{
        fontStyle: 'italic',
        fontSize: 13,
        color: '#2D3436',
        textAlign: 'center',
        padding: '4px 0',
        borderBottom: '1px solid #2D3436',
        fontWeight: 500,
      }}>
        Appointment Schedule
      </div>

      {calendarErrors && calendarErrors.length > 0 ? (
        <div style={{ background: '#FFEBEE', color: '#C62828', fontSize: 11, padding: '4px 8px', borderBottom: '1px solid #EF9A9A' }}>
          {calendarErrors.map((e, i) => (
            <div key={i}>
              {e.provider ? `${e.provider}: ` : ''}{e.email ? `(${e.email}) ` : ''}{e.message} — reconnect from Settings.
            </div>
          ))}
        </div>
      ) : null}

      <AllDayPills events={allDay} />

      {editing ? (
        <div style={{ padding: '6px 0', borderBottom: '1px dashed #C9BB9A' }}>
          <ManualEditor
            block={editing.block}
            dateISO={dateISO}
            onSave={editing.mode === 'new' ? handleSaveNew : handleSaveEdit}
            onDelete={handleDelete}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : null}

      <div
        ref={containerRef}
        onClick={handleEmptyClick}
        style={{
          position: 'relative',
          height: (HOURS + 1) * PX_PER_HOUR,
          background: 'transparent',
          cursor: editing ? 'default' : 'crosshair',
        }}
      >
        {/* hour grid lines and labels — skip the top line, the section underline already serves as it */}
        {Array.from({ length: HOURS + 1 }).map((_, i) => {
          const h = START_HOUR + i;
          return (
            <div key={i} style={{
              position: 'absolute',
              top: i * PX_PER_HOUR, left: 0, right: 0,
              borderTop: i === 0 ? 'none' : '1px solid #C9BB9A',
              fontSize: 11,
              color: '#6B5B40',
              paddingLeft: 4,
              paddingTop: 2,
              pointerEvents: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {h <= END_HOUR ? hourLabel(h) : ''}
            </div>
          );
        })}
        {/* event blocks */}
        {laidOut.map((b) => {
          const startFrac = Math.max(START_HOUR, b._start);
          const endFrac = Math.min(END_HOUR, b._end);
          if (endFrac <= startFrac) return null;
          const top = (startFrac - START_HOUR) * PX_PER_HOUR;
          const height = Math.max(20, (endFrac - startFrac) * PX_PER_HOUR);
          const widthPct = 95 / b.columnsInBand;
          const leftPct = 4 + b.column * widthPct;
          if (b.provider === 'manual') {
            return (
              <ManualBlock key={`m-${b.id}`} appt={b._appt}
                top={top} height={height} leftPct={leftPct} widthPct={widthPct}
                onClick={(e) => { e.stopPropagation(); setEditing({ mode: 'edit', block: b._appt }); }}
              />
            );
          }
          return (
            <ExternalBlock key={b.id} ev={b}
              top={top} height={height} leftPct={leftPct} widthPct={widthPct}
            />
          );
        })}
      </div>
    </div>
  );
}
