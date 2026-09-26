import React, { useEffect, useState } from 'react';
import {
  getMasterTasks, createMasterTask, updateMasterTask, deleteMasterTask, reorderMasterTasks,
} from '../services/api';
import CheckMark from './CheckMark';
import { sortByOrder } from '../utils/dayInfo';
import { COLORS, GOAL_WASH, card, dropZoneBorders, newRowInput, rowInput, uppercaseHeading } from '../styles';

function Column({ title, wash, items, onCreate, onPatch, onDelete, onDragStart, onDropRow }) {
  const [text, setText] = useState('');

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    await onCreate(t);
    setText('');
  };

  return (
    <div style={{ ...card, padding: '0 0 10px', overflow: 'hidden' }}>
      <div style={{
        background: wash.bg, color: wash.fg,
        fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
        padding: '12px 20px', marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{ padding: '0 10px' }}>
        {items.map((m) => (
          <Row key={m.id} item={m} onPatch={onPatch} onDelete={onDelete} onDragStart={onDragStart} onDropRow={onDropRow} />
        ))}
        <div style={{
          display: 'grid', gridTemplateColumns: '28px 1fr',
          alignItems: 'center', minHeight: 36,
        }}>
          <div style={{ textAlign: 'center', color: COLORS.faint, fontSize: 16 }}>+</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Add item..."
            style={newRowInput}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ item, onPatch, onDelete, onDragStart, onDropRow }) {
  const [text, setText] = useState(item.text);
  const [dropZone, setDropZone] = useState(null);
  useEffect(() => { setText(item.text); }, [item.text]);

  const commit = async () => {
    const t = text.trim();
    if (!t) {
      await onDelete(item.id);
    } else if (t !== item.text) {
      await onPatch(item.id, { text: t });
    }
  };

  const toggle = async () => {
    await onPatch(item.id, { status: item.status === 'done' ? 'open' : 'done' });
  };

  const handleDragOver = (e) => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-planner-master-task')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropZone(e.clientY - rect.top < rect.height / 2 ? 'above' : 'below');
  };
  const handleDragLeave = () => setDropZone(null);
  const handleDrop = (e) => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-planner-master-task')) return;
    e.preventDefault();
    e.stopPropagation();
    const here = dropZone || 'below';
    setDropZone(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/x-planner-master-task'));
      if (payload.id !== item.id) onDropRow(payload.id, item.id, here);
    } catch (_) {}
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, item)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="row-hover"
      style={{
        display: 'grid', gridTemplateColumns: '1fr 28px', alignItems: 'center',
        ...dropZoneBorders(dropZone),
        minHeight: 36,
        borderRadius: 8,
        cursor: 'grab',
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
        style={{
          ...rowInput,
          color: item.status === 'done' ? COLORS.muted : COLORS.ink,
          textDecoration: item.status === 'done' ? 'line-through' : 'none',
          textDecorationColor: COLORS.muted,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
        <CheckMark done={item.status === 'done'} onClick={toggle} />
      </div>
    </div>
  );
}

// The "Monthly Goals" section: Personal | Business running lists for the month.
export default function MonthlyGoals({ year, month }) {
  const y = Number(year);
  const m = Number(month);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    setItems([]);
    setError(null);
    getMasterTasks(y, m)
      .then((rows) => { if (alive) setItems(rows); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [y, m]);

  const personal = items.filter((i) => i.category === 'personal').sort(sortByOrder);
  const business = items.filter((i) => i.category === 'business').sort(sortByOrder);

  const handleCreate = (category) => async (text) => {
    const created = await createMasterTask({ year: y, month: m, category, text });
    setItems((cur) => [...cur, created]);
  };
  const handlePatch = async (id, patch) => {
    const updated = await updateMasterTask(id, patch);
    setItems((cur) => cur.map((x) => x.id === id ? updated : x));
  };
  const handleDelete = async (id) => {
    await deleteMasterTask(id);
    setItems((cur) => cur.filter((x) => x.id !== id));
  };

  const handleDragStart = (e, item) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/x-planner-master-task',
      JSON.stringify({ id: item.id, category: item.category })
    );
  };

  const handleReorder = async (sourceId, targetId, position) => {
    const src = items.find((i) => i.id === sourceId);
    const tgt = items.find((i) => i.id === targetId);
    if (!src || !tgt) return;
    if (src.category !== tgt.category) return; // only reorder within the same column
    const siblings = items
      .filter((i) => i.category === src.category && i.id !== sourceId)
      .sort(sortByOrder);
    const tgtIdx = siblings.findIndex((i) => i.id === targetId);
    if (tgtIdx < 0) return;
    const insertAt = position === 'above' ? tgtIdx : tgtIdx + 1;
    const newSiblings = [...siblings.slice(0, insertAt), src, ...siblings.slice(insertAt)];
    const newIds = newSiblings.map((i) => i.id);
    setItems((cur) => cur.map((x) => {
      const idx = newIds.indexOf(x.id);
      return idx >= 0 ? { ...x, order_index: idx } : x;
    }));
    try { await reorderMasterTasks(newIds); } catch (err) { console.error('reorderMasterTasks failed', err); }
  };

  const sheet = (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...uppercaseHeading, padding: '0 0 12px' }}>Monthly Goals</div>
      {error && <div style={{ padding: '0 0 12px', color: COLORS.danger }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <Column title="Personal" wash={GOAL_WASH.personal} items={personal} onCreate={handleCreate('personal')} onPatch={handlePatch} onDelete={handleDelete} onDragStart={handleDragStart} onDropRow={handleReorder} />
        <Column title="Business" wash={GOAL_WASH.business} items={business} onCreate={handleCreate('business')} onPatch={handlePatch} onDelete={handleDelete} onDragStart={handleDragStart} onDropRow={handleReorder} />
      </div>
    </div>
  );

  return sheet;
}
