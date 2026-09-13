import React from 'react';
import { createNote, updateNote, deleteNote, reorderNotes } from '../services/api';
import NestedListSection from './NestedListSection';

const api = { create: createNote, update: updateNote, remove: deleteNote, reorder: reorderNotes };

// The "Tasks" section of the daily spread: per-day nested note entries.
export default function DailyNotes({ dateISO, notes, onChange, onDropTask, onDropOngoing }) {
  return (
    <NestedListSection
      title="Tasks"
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
