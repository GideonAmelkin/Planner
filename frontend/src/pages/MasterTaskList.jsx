import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  getMasterTasks, createMasterTask, updateMasterTask, deleteMasterTask, reorderMasterTasks,
} from '../services/api';
import NavLinks from '../components/NavLinks';
import { CheckMark } from '../components/PrioritizedTaskList';

function Column({ title, items, rowTarget, onCreate, onPatch, onDelete, onDragStart, onDropRow }) {
  const [text, setText] = useState('');

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    await onCreate(t);
    setText('');
  };

  return (
    <div style={{ borderRight: title === 'Personal' ? '1px solid #2D3436' : 'none' }}>
      <div style={{ fontStyle: 'italic', fontSize: 13, color: '#6B5B40', textAlign: 'center', padding: '4px 0', borderBottom: '1px solid #2D3436' }}>
        {title}
      </div>
      <div>
        {items.map((m) => (
          <Row key={m.id} item={m} onPatch={onPatch} onDelete={onDelete} onDragStart={onDragStart} onDropRow={onDropRow} />
        ))}
        <div style={{
          display: 'grid', gridTemplateColumns: '28px 1fr',
          alignItems: 'center', borderTop: '1px solid #C9BB9A',
          background: '#FBF6E7',
        }}>
          <div style={{ textAlign: 'center', color: '#A89368' }}>+</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Add item..."
            style={{ border: 'none', background: 'transparent', padding: '6px 8px', fontSize: 14, width: '100%', color: '#2D3436' }}
          />
        </div>
        {Array.from({ length: Math.max(0, rowTarget - items.length) }).map((_, i) => (
          <div key={`pad-${i}`} style={{ borderTop: '1px solid #C9BB9A', minHeight: 26 }} />
        ))}
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
      style={{
        display: 'grid', gridTemplateColumns: '1fr 28px', alignItems: 'flex-start',
        borderTop: dropZone === 'above' ? '2px solid #2D3436' : 'none',
        borderBottom: dropZone === 'below' ? '2px solid #2D3436' : '1px solid #C9BB9A',
        minHeight: 30,
        cursor: 'grab',
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
        style={{
          border: 'none', background: 'transparent', padding: '4px 8px', fontSize: 14, width: '100%',
          color: '#2D3436',
          textDecoration: item.status === 'done' ? 'line-through' : 'none',
          textDecorationColor: '#6B5B40',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
        <CheckMark done={item.status === 'done'} onClick={toggle} />
      </div>
    </div>
  );
}

export default function MasterTaskList({ year: yearProp, month: monthProp, embedded = false }) {
  const params = useParams();
  const y = embedded ? Number(yearProp) : Number(params.year);
  const m = embedded ? Number(monthProp) : Number(params.month);
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

  const sortByOrder = (a, b) => (a.order_index || 0) - (b.order_index || 0) || a.id - b.id;
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

  const monthLabel = format(new Date(y, m - 1, 1), 'MMMM yyyy');

  const navBtn = {
    border: '1px solid white', color: 'white', background: 'transparent',
    padding: '4px 12px', fontSize: 12, fontWeight: 600, letterSpacing: 0.5, borderRadius: 2,
  };

  const prevMonth = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };

  const sheet = (
    <div style={{ maxWidth: embedded ? '100%' : 1100, margin: embedded ? '0 auto' : '24px auto', padding: '0 24px', background: '#FBF6E7', border: '1px solid #C9BB9A', boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
      {embedded ? (
        <div style={{ padding: '18px 0 12px 0' }}>
          <div style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 1,
            paddingTop: 4,
            lineHeight: 1.2,
            textTransform: 'uppercase',
          }}>Monthly Goals</div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0 8px 0' }}>
          <div className="serif" style={{ fontSize: 22, fontWeight: 500 }}>{monthLabel}</div>
          <div className="serif" style={{ fontSize: 16, fontStyle: 'italic', color: '#6B5B40' }}>Master Task List</div>
        </div>
      )}
      {error && <div style={{ padding: 16, color: '#C62828' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #2D3436', borderBottom: '1px solid #2D3436' }}>
        <Column title="Personal" items={personal} rowTarget={Math.max(personal.length, business.length) + 4} onCreate={handleCreate('personal')} onPatch={handlePatch} onDelete={handleDelete} onDragStart={handleDragStart} onDropRow={handleReorder} />
        <Column title="Business" items={business} rowTarget={Math.max(personal.length, business.length) + 4} onCreate={handleCreate('business')} onPatch={handlePatch} onDelete={handleDelete} onDragStart={handleDragStart} onDropRow={handleReorder} />
      </div>
      <div style={{ height: 24 }} />
    </div>
  );

  if (embedded) return sheet;

  return (
    <div>
      <div style={{ background: '#2D3436', color: 'white', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '4px double #C9BB9A' }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: 1, marginRight: 16 }}>Planner</div>
        <Link to={`/master/${prevMonth.y}/${prevMonth.m}`} style={navBtn}>◀ Prev</Link>
        <Link to={`/master/${nextMonth.y}/${nextMonth.m}`} style={navBtn}>Next ▶</Link>
        <div style={{ flex: 1 }} />
        <NavLinks dateISO={`${y}-${String(m).padStart(2, '0')}-01`} />
      </div>
      {sheet}
    </div>
  );
}
