import React from 'react';
import { createNote, updateNote, deleteNote, reorderNotes } from '../shared/api';
import NestedListSection from './NestedListSection';
import { SECTION_DOTS } from '../shared/styles';

const api = { create: createNote, update: updateNote, remove: deleteNote, reorder: reorderNotes };

// The "Tasks" section of the daily spread: per-day nested note entries.
export default function DailyNotes({ dateISO, notes, onChange, onDropTask, onDropOngoing }) {
  return (
    <NestedListSection
      title="Tasks"
      dot={SECTION_DOTS.tasks}
      items={notes}
      onChange={onChange}
      api={api}
      mime="application/x-planner-note"
      dateISO={dateISO}
      placeholder="Add note..."
      externalDrops={{
        'application/x-planner-task': onDropTask,
        'application/x-planner-ongoing': onDropOngoing,
      }}
    />
  );
}
