import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TopNav from '../components/TopNav';
import MiniCalendar from '../components/MiniCalendar';
import TimelineSchedule from '../components/TimelineSchedule';
import PrioritizedTaskList from '../components/PrioritizedTaskList';
import DailyNotes from '../components/DailyNotes';
import Ongoing from '../components/Ongoing';
import DailyNotesText from '../components/DailyNotesText';
import QuoteHeader from '../components/QuoteHeader';
import { dayInfo } from '../utils/dayInfo';
import {
  getDay, pullForwardDay,
  createTask, deleteTask,
  createNote, deleteNote,
  createOngoing, deleteOngoing,
} from '../services/api';

export default function DailyView() {
  const { date } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pullStatus, setPullStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    setPullStatus(null);
    getDay(date)
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) setError(err.message || String(err)); });
    return () => { alive = false; };
  }, [date]);

  const setTasks = useCallback((tasks) => setData((d) => d ? { ...d, tasks } : d), []);
  const setAppointments = useCallback((appointments) => setData((d) => d ? { ...d, appointments } : d), []);
  const setNotes = useCallback((notes) => setData((d) => d ? { ...d, notes } : d), []);
  const setOngoing = useCallback((ongoing) => setData((d) => d ? { ...d, ongoing } : d), []);
  const setNotesText = useCallback((notes_text) => setData((d) => d ? { ...d, notes_text } : d), []);

  const handlePullForward = useCallback(async () => {
    try {
      const result = await pullForwardDay(date);
      const t = result.rolledTasks || 0;
      const n = result.movedNotes || 0;
      if (t === 0 && n === 0) {
        setPullStatus({ message: 'Nothing to pull — all caught up.', error: false });
      } else {
        const parts = [];
        if (t) parts.push(`${t} task${t === 1 ? '' : 's'}`);
        if (n) parts.push(`${n} note${n === 1 ? '' : 's'}`);
        setPullStatus({ message: `Pulled ${parts.join(' and ')} forward.`, error: false });
        const fresh = await getDay(date);
        setData(fresh);
      }
    } catch (err) {
      console.error('Pull forward failed:', err);
      setPullStatus({ message: `Pull forward failed: ${err.message || err}`, error: true });
    }
    setTimeout(() => setPullStatus(null), 2500);
  }, [date]);

  const handleDropNoteOnTasks = useCallback(async ({ id, text, children }) => {
    const parent = await createTask({ date, text });
    for (const c of (children || [])) {
      await createTask({ date, text: c.text, parent_id: parent.id });
    }
    for (const c of (children || [])) {
      await deleteNote(c.id);
    }
    await deleteNote(id);
    const fresh = await getDay(date);
    setData(fresh);
  }, [date]);

  const handleDropTaskOnNotes = useCallback(async ({ id, text, children }) => {
    const parent = await createNote({ date, text });
    for (const c of (children || [])) {
      await createNote({ date, text: c.text, parent_id: parent.id });
    }
    for (const c of (children || [])) {
      await deleteTask(c.id);
    }
    await deleteTask(id);
    const fresh = await getDay(date);
    setData(fresh);
  }, [date]);

  const handleDropTaskOnOngoing = useCallback(async ({ id, text, children }) => {
    const parent = await createOngoing({ text });
    for (const c of (children || [])) {
      await createOngoing({ text: c.text, parent_id: parent.id });
    }
    for (const c of (children || [])) {
      await deleteTask(c.id);
    }
    await deleteTask(id);
    const fresh = await getDay(date);
    setData(fresh);
  }, [date]);

  const handleDropNoteOnOngoing = useCallback(async ({ id, text, children }) => {
    const parent = await createOngoing({ text });
    for (const c of (children || [])) {
      await createOngoing({ text: c.text, parent_id: parent.id });
    }
    for (const c of (children || [])) {
      await deleteNote(c.id);
    }
    await deleteNote(id);
    const fresh = await getDay(date);
    setData(fresh);
  }, [date]);

  const handleDropOngoingOnTasks = useCallback(async ({ id, text, children }) => {
    const parent = await createTask({ date, text });
    for (const c of (children || [])) {
      await createTask({ date, text: c.text, parent_id: parent.id });
    }
    for (const c of (children || [])) {
      await deleteOngoing(c.id);
    }
    await deleteOngoing(id);
    const fresh = await getDay(date);
    setData(fresh);
  }, [date]);

  const handleDropOngoingOnNotes = useCallback(async ({ id, text, children }) => {
    const parent = await createNote({ date, text });
    for (const c of (children || [])) {
      await createNote({ date, text: c.text, parent_id: parent.id });
    }
    for (const c of (children || [])) {
      await deleteOngoing(c.id);
    }
    await deleteOngoing(id);
    const fresh = await getDay(date);
    setData(fresh);
  }, [date]);

  if (error) {
    return (
      <div>
        <TopNav dateISO={date} />
        <div style={{ padding: 32, color: '#C62828' }}>Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <TopNav dateISO={date} />
        <div style={{ padding: 32, color: '#6B5B40' }}>Loading…</div>
      </div>
    );
  }

  const info = dayInfo(date);

  const cellBase = {
    background: '#FBF6E7',
    padding: '18px 18px',
  };
  const cellLeftBorder = { borderRight: '1px dashed #B5A88A' };

  return (
    <div>
      <TopNav dateISO={date} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto 1fr',
        gap: 0,
        maxWidth: 1500,
        margin: '0 auto',
        padding: '24px 24px 64px 24px',
      }}>
        {/* Top-left: single-line date + mini-calendar */}
        <div style={{ ...cellBase, ...cellLeftBorder, paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 1,
              paddingTop: 4,
              lineHeight: 1.2,
              textTransform: 'uppercase',
            }}>
              {info.headlineDate}
            </div>
            <MiniCalendar dateISO={date} />
          </div>
        </div>

        {/* Top-right: quote on left, day-info badge on right */}
        <div style={{ ...cellBase, paddingBottom: 12 }}>
          <QuoteHeader dateISO={date} quote={data.quote} />
        </div>

        {/* Bottom-left: appointment schedule (time-block timeline) */}
        <div style={{ ...cellBase, ...cellLeftBorder, paddingTop: 0 }}>
          <TimelineSchedule
            dateISO={date}
            appointments={data.appointments}
            externalEvents={data.external_events || []}
            calendarErrors={data.calendar_errors || []}
            onChange={setAppointments}
          />
        </div>

        {/* Bottom-right: action items + daily notes */}
        <div style={{ ...cellBase, paddingTop: 0, display: 'flex', flexDirection: 'column' }}>
          <PrioritizedTaskList
            dateISO={date}
            tasks={data.tasks}
            onChange={setTasks}
            onPullForward={handlePullForward}
            onDropNote={handleDropNoteOnTasks}
            onDropOngoing={handleDropOngoingOnTasks}
            pullStatus={pullStatus}
          />
          <DailyNotes
            dateISO={date}
            notes={data.notes}
            onChange={setNotes}
            onDropTask={handleDropTaskOnNotes}
            onDropOngoing={handleDropOngoingOnNotes}
          />
          <Ongoing
            ongoing={data.ongoing || []}
            onChange={setOngoing}
            onDropTask={handleDropTaskOnOngoing}
            onDropNote={handleDropNoteOnOngoing}
          />
          <DailyNotesText
            dateISO={date}
            value={data.notes_text}
            onChange={setNotesText}
          />
        </div>
      </div>
    </div>
  );
}
