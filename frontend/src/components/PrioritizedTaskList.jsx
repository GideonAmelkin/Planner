import React, { Fragment, useEffect, useRef, useState } from 'react';
import { createTask, updateTask, deleteTask, reorderTasks } from '../services/api';

const INDENT_PX = 24;

function CheckMark({ done, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={done ? 'Mark not done' : 'Mark done'}
      style={{
        width: 22, height: 22,
        border: 'none', background: 'transparent',
        padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle
          cx="10" cy="10" r="9"
          fill={done ? '#2E7D32' : 'transparent'}
          stroke={done ? '#2E7D32' : '#A89368'}
          strokeWidth="1.5"
        />
        <path
          d="M5.6 10.4 L8.6 13.4 L14.4 7.2"
          fill="none"
          stroke={done ? 'white' : '#A89368'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={done ? 1 : 0.55}
        />
      </svg>
    </button>
  );
}

function TaskRow({ task, isChild, onPatch, onDelete, onDragStart, onIndent, onUnindent, onAddChild, onReorder }) {
  const [text, setText] = useState(task.text);
  const [dropZone, setDropZone] = useState(null); // 'above' | 'below' | null
  useEffect(() => { setText(task.text); }, [task.text]);

  const handleRowDragOver = (e) => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-planner-task')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropZone(e.clientY - rect.top < rect.height / 2 ? 'above' : 'below');
  };
  const handleRowDragLeave = () => setDropZone(null);
  const handleRowDrop = (e) => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-planner-task')) return;
    e.preventDefault();
    e.stopPropagation();
    const here = dropZone || 'below';
    setDropZone(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/x-planner-task'));
      if (payload.id !== task.id) onReorder(payload.id, task.id, here);
    } catch (_) {}
  };

  const commitText = async () => {
    const t = text.trim();
    if (!t) {
      await deleteTask(task.id);
      onDelete(task.id);
    } else if (t !== task.text) {
      const updated = await updateTask(task.id, { text: t });
      onPatch(updated);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (!isChild) { e.preventDefault(); onIndent(task.id); }
    } else if (e.key === 'Tab' && e.shiftKey) {
      if (isChild) { e.preventDefault(); onUnindent(task.id); }
    } else if (e.key === 'Enter') {
      if (isChild && task.parent_id) {
        e.preventDefault();
        onAddChild(task.parent_id);
      } else {
        e.target.blur();
      }
    }
  };

  const toggleDone = async () => {
    const next = task.status === 'completed' ? 'in_process' : 'completed';
    const updated = await updateTask(task.id, { status: next });
    onPatch(updated);
  };

  const done = task.status === 'completed';

  if (isChild) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, task)}
        onDragOver={handleRowDragOver}
        onDragLeave={handleRowDragLeave}
        onDrop={handleRowDrop}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 28px',
          alignItems: 'center',
          borderTop: dropZone === 'above' ? '2px solid #2D3436' : '1px solid #C9BB9A',
          borderBottom: dropZone === 'below' ? '2px solid #2D3436' : 'none',
          minHeight: 30,
          paddingLeft: INDENT_PX,
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#A89368', fontSize: 14, paddingLeft: 4, paddingRight: 4 }}>-</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={onKeyDown}
            style={{
              border: 'none', background: 'transparent',
              padding: '4px 8px', fontSize: 14,
              width: '100%',
              color: done ? '#6B5B40' : '#2D3436',
              textDecoration: done ? 'line-through' : 'none',
              textDecorationColor: '#6B5B40',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckMark done={done} onClick={toggleDone} />
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragOver={handleRowDragOver}
      onDragLeave={handleRowDragLeave}
      onDrop={handleRowDrop}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 28px 24px',
        alignItems: 'center',
        borderTop: dropZone === 'above' ? '2px solid #2D3436' : '1px solid #C9BB9A',
        borderBottom: dropZone === 'below' ? '2px solid #2D3436' : 'none',
        minHeight: 30,
        cursor: 'grab',
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={onKeyDown}
        style={{
          border: 'none', background: 'transparent',
          padding: '4px 8px', fontSize: 14,
          width: '100%',
          color: done ? '#6B5B40' : '#2D3436',
          textDecoration: done ? 'line-through' : 'none',
          textDecorationColor: '#6B5B40',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CheckMark done={done} onClick={toggleDone} />
      </div>
      <button
        type="button"
        onClick={() => onAddChild(task.id)}
        title="Add sub-item"
        style={{
          border: 'none', background: 'transparent',
          color: '#A89368', fontSize: 16, cursor: 'pointer',
          padding: 0, lineHeight: 1,
        }}
      >+</button>
    </div>
  );
}

function NewChildTaskRow({ dateISO, parentId, siblingOrderStart, onCreate, onCancel }) {
  const [text, setText] = useState('');
  const [count, setCount] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const commit = async () => {
    const t = text.trim();
    if (!t) { onCancel(); return; }
    const created = await createTask({
      date: dateISO,
      text: t,
      parent_id: parentId,
      order_index: siblingOrderStart + count,
    });
    onCreate(created);
    setCount((c) => c + 1);
    setText('');
    inputRef.current && inputRef.current.focus();
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr',
      alignItems: 'center', borderTop: '1px solid #C9BB9A',
      background: '#FBF6E7',
      paddingLeft: INDENT_PX,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#A89368', fontSize: 14, paddingLeft: 4, paddingRight: 4 }}>-</span>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') { setText(''); onCancel(); }
          }}
          placeholder="Add sub-item..."
          style={{
            border: 'none', background: 'transparent',
            padding: '6px 8px', fontSize: 14, width: '100%',
            color: '#2D3436',
          }}
        />
      </div>
    </div>
  );
}

function NewTaskRow({ dateISO, onCreate }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const commit = async () => {
    const t = text.trim();
    if (!t) return;
    const created = await createTask({ date: dateISO, text: t });
    onCreate(created);
    setText('');
    inputRef.current && inputRef.current.focus();
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 28px',
      alignItems: 'center', borderTop: '1px solid #C9BB9A',
      background: '#FBF6E7',
    }}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        placeholder="Add task..."
        style={{
          border: 'none', background: 'transparent', padding: '6px 8px', fontSize: 14, width: '100%',
          color: '#2D3436',
        }}
      />
      <div style={{ color: '#A89368', textAlign: 'center', fontSize: 16 }}>+</div>
    </div>
  );
}

export default function PrioritizedTaskList({ dateISO, tasks, onChange, onPullForward, onDropNote, pullStatus }) {
  const handleCreate = (t) => onChange([...tasks, t]);
  const handlePatch = (t) => onChange(tasks.map((x) => x.id === t.id ? t : x));
  const handleDelete = (id) =>
    onChange(tasks.filter((x) => x.id !== id && x.parent_id !== id));

  const [dragOver, setDragOver] = useState(false);
  const [addingChildOf, setAddingChildOf] = useState(null);

  // Hide forwarded source rows.
  const visible = tasks.filter((t) => t.status !== 'forwarded');

  const sortByPriority = (a, b) => {
    const order = { A: 1, B: 2, C: 3 };
    const ap = order[a.priority] || 9;
    const bp = order[b.priority] || 9;
    if (ap !== bp) return ap - bp;
    if ((a.priority_num || 99) !== (b.priority_num || 99)) return (a.priority_num || 99) - (b.priority_num || 99);
    return (a.order_index || 0) - (b.order_index || 0) || a.id - b.id;
  };
  const sortByOrder = (a, b) =>
    (a.order_index || 0) - (b.order_index || 0) || a.id - b.id;

  const topLevel = visible.filter((t) => !t.parent_id).sort(sortByPriority);
  const childrenOf = (parentId) =>
    visible.filter((t) => t.parent_id === parentId).sort(sortByOrder);

  const indent = async (taskId) => {
    const idx = topLevel.findIndex((t) => t.id === taskId);
    if (idx <= 0) return;
    const newParent = topLevel[idx - 1];
    const updated = await updateTask(taskId, { parent_id: newParent.id });
    handlePatch(updated);
  };

  const unindent = async (taskId) => {
    const updated = await updateTask(taskId, { parent_id: null });
    handlePatch(updated);
  };

  const handleAddChild = (parentId) => setAddingChildOf(parentId);

  const handleReorder = async (sourceId, targetId, position) => {
    const src = tasks.find((t) => t.id === sourceId);
    const tgt = tasks.find((t) => t.id === targetId);
    if (!src || !tgt) return;
    if (src.parent_id !== tgt.parent_id) return; // only reorder within the same level

    const siblings = (src.parent_id == null ? topLevel : childrenOf(src.parent_id))
      .filter((t) => t.id !== sourceId);
    const tgtIdx = siblings.findIndex((t) => t.id === targetId);
    if (tgtIdx < 0) return;
    const insertAt = position === 'above' ? tgtIdx : tgtIdx + 1;
    const newSiblings = [
      ...siblings.slice(0, insertAt),
      src,
      ...siblings.slice(insertAt),
    ];
    const newIds = newSiblings.map((t) => t.id);
    onChange(tasks.map((t) => {
      const idx = newIds.indexOf(t.id);
      return idx >= 0 ? { ...t, order_index: idx } : t;
    }));
    try { await reorderTasks(newIds); } catch (err) { console.error('reorderTasks failed', err); }
  };

  const handleTaskDragStart = (e, task) => {
    const children = visible
      .filter((t) => t.parent_id === task.id)
      .sort(sortByOrder)
      .map((t) => ({ id: t.id, text: t.text }));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/x-planner-task',
      JSON.stringify({ id: task.id, text: task.text, parent_id: task.parent_id, children })
    );
  };

  const handleDragOver = (e) => {
    if (Array.from(e.dataTransfer.types).includes('application/x-planner-note')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragOver) setDragOver(true);
    }
  };
  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  };
  const handleDrop = (e) => {
    const raw = e.dataTransfer.getData('application/x-planner-note');
    setDragOver(false);
    if (!raw) return;
    e.preventDefault();
    try {
      const payload = JSON.parse(raw);
      onDropNote && onDropNote(payload);
    } catch (_) {}
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        borderBottom: '1px solid #2D3436',
        background: dragOver ? 'rgba(201, 187, 154, 0.18)' : 'transparent',
        transition: 'background 100ms',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid #2D3436',
      }}>
        <span />
        <span style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: '#2D3436',
          textAlign: 'center',
          fontWeight: 500,
        }}>
          Action Items
        </span>
        <button
          type="button"
          onClick={onPullForward}
          title="Pull unfinished tasks and notes from prior days into this day"
          style={{
            justifySelf: 'end',
            border: 'none',
            background: 'transparent',
            color: '#6B5B40',
            fontSize: 11,
            cursor: 'pointer',
            padding: '0 6px',
            fontStyle: 'italic',
          }}
        >
          Pull forward →
        </button>
      </div>
      {pullStatus ? (
        <div style={{
          padding: '3px 8px',
          fontSize: 11,
          fontStyle: 'italic',
          color: pullStatus.error ? '#C62828' : '#6B5B40',
          background: pullStatus.error ? '#FFEBEE' : '#FBF6E7',
          borderBottom: '1px solid #C9BB9A',
        }}>
          {pullStatus.message}
        </div>
      ) : null}
      {topLevel.map((t) => {
        const kids = childrenOf(t.id);
        const nextOrder = kids.length
          ? (kids[kids.length - 1].order_index || 0) + 1
          : 0;
        return (
          <Fragment key={t.id}>
            <TaskRow
              task={t}
              isChild={false}
              onPatch={handlePatch}
              onDelete={handleDelete}
              onDragStart={handleTaskDragStart}
              onIndent={indent}
              onUnindent={unindent}
              onAddChild={handleAddChild}
              onReorder={handleReorder}
            />
            {kids.map((child) => (
              <TaskRow
                key={child.id}
                task={child}
                isChild={true}
                onPatch={handlePatch}
                onDelete={handleDelete}
                onDragStart={handleTaskDragStart}
                onIndent={indent}
                onUnindent={unindent}
                onAddChild={handleAddChild}
                onReorder={handleReorder}
              />
            ))}
            {addingChildOf === t.id ? (
              <NewChildTaskRow
                dateISO={dateISO}
                parentId={t.id}
                siblingOrderStart={nextOrder}
                onCreate={handleCreate}
                onCancel={() => setAddingChildOf(null)}
              />
            ) : null}
          </Fragment>
        );
      })}
      <NewTaskRow dateISO={dateISO} onCreate={handleCreate} />
    </div>
  );
}
