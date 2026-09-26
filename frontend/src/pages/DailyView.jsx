import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AgendaRail from '../components/AgendaRail';
import DateCard from '../components/DateCard';
import TimelineSchedule from '../components/TimelineSchedule';
import PrioritizedTaskList from '../components/PrioritizedTaskList';
import DailyNotes from '../components/DailyNotes';
import Ongoing from '../components/Ongoing';
import DailyNotesText from '../components/DailyNotesText';
import MonthlyGoals from '../components/MonthlyGoals';
import CalendarSection from '../components/CalendarSection';
import { COLORS, card } from '../styles';
import {
  getDay, pullForwardDay,
  createTask, deleteTask,
  createNote, deleteNote,
  createOngoing, deleteOngoing,
} from '../services/api';

const PULL_STATUS_MS = 2500;
const SPREAD_MAX_WIDTH = 1500;

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
        setPullStatus({ message: 'Nothing to pull, all caught up.', error: false });
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
    setTimeout(() => setPullStatus(null), PULL_STATUS_MS);
  }, [date]);

  // Moving a row between sections = recreate it (and its children) in the
  // target section, delete the originals, then reload the day.
  const movers = useMemo(() => {
    const move = (createFn, deleteFn) => async ({ id, text, children }) => {
      const parent = await createFn({ text });
      for (const c of (children || [])) {
        await createFn({ text: c.text, parent_id: parent.id });
      }
      for (const c of (children || [])) {
        await deleteFn(c.id);
      }
      await deleteFn(id);
      const fresh = await getDay(date);
      setData(fresh);
    };
    const task = (p) => createTask({ date, ...p });
    const note = (p) => createNote({ date, ...p });
    return {
      noteToTasks: move(task, deleteNote),
      ongoingToTasks: move(task, deleteOngoing),
      taskToNotes: move(note, deleteTask),
      ongoingToNotes: move(note, deleteOngoing),
      taskToOngoing: move(createOngoing, deleteTask),
      noteToOngoing: move(createOngoing, deleteNote),
    };
  }, [date]);

  const shell = (children) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh' }}>
      <AgendaRail dateISO={date} section="agenda" />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );

  if (error) {
    return shell(<div style={{ padding: 32, color: COLORS.danger }}>Error: {error}</div>);
  }

  if (!data) {
    return shell(<div style={{ padding: 32, color: COLORS.muted }}>Loading...</div>);
  }

  const columnCard = { ...card, display: 'flex', flexDirection: 'column' };
  const sectionDivider = { borderTop: `1px solid ${COLORS.hairline}`, margin: '18px 0' };

  return shell(
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto 1fr',
        gap: 20,
        maxWidth: SPREAD_MAX_WIDTH,
        margin: '0 auto',
        padding: '24px 24px 0 24px',
      }}>
        {/* Top, both columns: headline, day controls, pills, quote, mini calendar */}
        <DateCard dateISO={date} quote={data.quote} />

        {/* Left: appointment schedule (time-block timeline) */}
        <div style={columnCard}>
          <TimelineSchedule
            dateISO={date}
            appointments={data.appointments}
            externalEvents={data.external_events || []}
            calendarErrors={data.calendar_errors || []}
            onChange={setAppointments}
          />
        </div>

        {/* Right: one card holding the four lists */}
        <div style={columnCard}>
          <PrioritizedTaskList
            dateISO={date}
            tasks={data.tasks}
            onChange={setTasks}
            onPullForward={handlePullForward}
            onDropNote={movers.noteToTasks}
            onDropOngoing={movers.ongoingToTasks}
            pullStatus={pullStatus}
          />
          <div style={sectionDivider} />
          <DailyNotes
            dateISO={date}
            notes={data.notes}
            onChange={setNotes}
            onDropTask={movers.taskToNotes}
            onDropOngoing={movers.ongoingToNotes}
          />
          <div style={sectionDivider} />
          <Ongoing
            ongoing={data.ongoing || []}
            onChange={setOngoing}
            onDropTask={movers.taskToOngoing}
            onDropNote={movers.noteToOngoing}
          />
          <div style={sectionDivider} />
          <DailyNotesText
            dateISO={date}
            value={data.notes_text}
            onChange={setNotesText}
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        alignItems: 'start',
        maxWidth: SPREAD_MAX_WIDTH,
        margin: '0 auto',
        padding: '32px 24px 64px 24px',
      }}>
        <MonthlyGoals year={Number(date.slice(0, 4))} month={Number(date.slice(5, 7))} />
        <CalendarSection year={Number(date.slice(0, 4))} month={Number(date.slice(5, 7))} />
      </div>
    </>
  );
}
