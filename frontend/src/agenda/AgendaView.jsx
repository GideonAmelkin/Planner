import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AgendaRail from '../shared/AgendaRail';
import DateCard from './DateCard';
import TimelineSchedule from './TimelineSchedule';
import PrioritizedTaskList from './PrioritizedTaskList';
import DailyNotes from './DailyNotes';
import Ongoing from './Ongoing';
import DailyNotesText from './DailyNotesText';
import MonthlyGoals from './MonthlyGoals';
import CalendarSection from './CalendarSection';
import { COLORS, card } from '../shared/styles';
import { getDay } from '../shared/api';
import { createTask, deleteTask, createNote, deleteNote, createOngoing, deleteOngoing } from './api';

const SPREAD_MAX_WIDTH = 1500;

export default function AgendaView() {
  const { date } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
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
            onDropNote={movers.noteToTasks}
            onDropOngoing={movers.ongoingToTasks}
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
