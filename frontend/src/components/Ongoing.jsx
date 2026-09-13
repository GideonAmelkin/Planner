import React from 'react';
import { createOngoing, updateOngoing, deleteOngoing, reorderOngoing } from '../services/api';
import NestedListSection from './NestedListSection';

const api = { create: createOngoing, update: updateOngoing, remove: deleteOngoing, reorder: reorderOngoing };

// The "Ongoing" section: nested items that are not tied to a date.
export default function Ongoing({ ongoing, onChange, onDropTask, onDropNote }) {
  return (
    <NestedListSection
      title="Ongoing"
      items={ongoing}
      onChange={onChange}
      api={api}
      mime="application/x-planner-ongoing"
      placeholder="Add item..."
      externalDrops={{
        'application/x-planner-task': onDropTask,
        'application/x-planner-note': onDropNote,
      }}
    />
  );
}
