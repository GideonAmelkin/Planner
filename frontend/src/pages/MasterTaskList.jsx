import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  getMasterTasks, createMasterTask, updateMasterTask, deleteMasterTask,
} from '../services/api';
import NavLinks from '../components/NavLinks';

function Column({ title, items, onCreate, onPatch, onDelete }) {
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
          <Row key={m.id} item={m} onPatch={onPatch} onDelete={onDelete} />
        ))}
        <div style={{
          display: 'grid', gridTemplateColumns: '24px 1fr',
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
        {Array.from({ length: Math.max(0, 26 - items.length - 1) }).map((_, i) => (
          <div key={`pad-${i}`} style={{ borderTop: '1px solid #C9BB9A', minHeight: 26 }} />
        ))}
      </div>
    </div>
  );
}

function Row({ item, onPatch, onDelete }) {
  const [text, setText] = useState(item.text);
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', alignItems: 'center', borderTop: '1px solid #C9BB9A' }}>
      <button
        onClick={toggle}
        title={item.status === 'done' ? 'Mark open' : 'Mark done'}
        style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, color: '#2D3436', height: 26 }}
      >
        {item.status === 'done' ? '✓' : '·'}
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
        style={{
          border: 'none', background: 'transparent', padding: '4px 8px', fontSize: 14, width: '100%',
          color: '#2D3436',
          textTransform: 'uppercase',
          textDecoration: item.status === 'done' ? 'line-through' : 'none',
          textDecorationColor: '#6B5B40',
        }}
      />
    </div>
  );
}

export default function MasterTaskList() {
  const { year, month } = useParams();
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

  const personal = items.filter((i) => i.category === 'personal');
  const business = items.filter((i) => i.category === 'business');

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

  const monthLabel = format(new Date(y, m - 1, 1), 'MMMM yyyy');

  const navBtn = {
    border: '1px solid white', color: 'white', background: 'transparent',
    padding: '4px 12px', fontSize: 12, fontWeight: 600, letterSpacing: 0.5, borderRadius: 2,
  };

  const prevMonth = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };

  return (
    <div>
      <div style={{ background: '#2D3436', color: 'white', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '4px double #C9BB9A' }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: 1, marginRight: 16 }}>Planner</div>
        <Link to={`/master/${prevMonth.y}/${prevMonth.m}`} style={navBtn}>◀ Prev</Link>
        <Link to={`/master/${nextMonth.y}/${nextMonth.m}`} style={navBtn}>Next ▶</Link>
        <div style={{ flex: 1 }} />
        <NavLinks dateISO={`${y}-${String(m).padStart(2, '0')}-01`} />
      </div>
      <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 24px', background: '#FBF6E7', border: '1px solid #C9BB9A', boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', padding: '20px 0 8px 0' }}>
          <div className="serif" style={{ fontSize: 22, fontWeight: 500 }}>{monthLabel}</div>
          <div className="serif" style={{ fontSize: 16, fontStyle: 'italic', color: '#6B5B40' }}>Master Task List</div>
        </div>
        {error && <div style={{ padding: 16, color: '#C62828' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #2D3436', borderBottom: '1px solid #2D3436' }}>
          <Column title="Personal" items={personal} onCreate={handleCreate('personal')} onPatch={handlePatch} onDelete={handleDelete} />
          <Column title="Business" items={business} onCreate={handleCreate('business')} onPatch={handlePatch} onDelete={handleDelete} />
        </div>
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
