import React, { Fragment, useEffect, useRef, useState } from 'react';
import { createOngoing, updateOngoing, deleteOngoing, reorderOngoing } from '../services/api';

const INDENT_PX = 24;

function OngoingRow({ item, isChild, onPatch, onDelete, onIndent, onUnindent, onAddChild, onDragStart, onReorder }) {
  const [text, setText] = useState(item.text);
  const [dropZone, setDropZone] = useState(null);
  useEffect(() => { setText(item.text); }, [item.text]);

  const handleRowDragOver = (e) => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-planner-ongoing')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropZone(e.clientY - rect.top < rect.height / 2 ? 'above' : 'below');
  };
  const handleRowDragLeave = () => setDropZone(null);
  const handleRowDrop = (e) => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-planner-ongoing')) return;
    e.preventDefault();
    e.stopPropagation();
    const here = dropZone || 'below';
    setDropZone(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/x-planner-ongoing'));
      if (payload.id !== item.id) onReorder(payload.id, item.id, here);
    } catch (_) {}
  };

  const commit = async () => {
    const t = text.trim();
    if (!t) {
      await deleteOngoing(item.id);
      onDelete(item.id);
    } else if (t !== item.text) {
      const updated = await updateOngoing(item.id, { text: t });
      onPatch(updated);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (!isChild) { e.preventDefault(); onIndent(item.id); }
    } else if (e.key === 'Tab' && e.shiftKey) {
      if (isChild) { e.preventDefault(); onUnindent(item.id); }
    } else if (e.key === 'Enter') {
      if (isChild && item.parent_id) {
        e.preventDefault();
        onAddChild(item.parent_id);
      } else {
        e.target.blur();
      }
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={handleRowDragOver}
      onDragLeave={handleRowDragLeave}
      onDrop={handleRowDrop}
      style={{
        display: 'grid',
        gridTemplateColumns: isChild ? '1fr' : '1fr 24px',
        alignItems: 'flex-start',
        borderTop: dropZone === 'above' ? '2px solid #2D3436' : 'none',
        borderBottom: dropZone === 'below' ? '2px solid #2D3436' : '1px solid #C9BB9A',
        minHeight: 30,
        paddingLeft: isChild ? INDENT_PX : 0,
        cursor: 'grab',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {isChild ? (
          <span style={{ color: '#A89368', fontSize: 14, paddingLeft: 4, paddingRight: 4 }}>-</span>
        ) : null}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          style={{
            border: 'none', background: 'transparent',
            padding: '4px 8px', fontSize: 14,
            width: '100%',
            color: '#2D3436',
          }}
        />
      </div>
      {!isChild ? (
        <button
          type="button"
          onClick={() => onAddChild(item.id)}
          title="Add sub-item"
          style={{
            border: 'none', background: 'transparent',
            color: '#A89368', fontSize: 16, cursor: 'pointer',
            padding: 0, lineHeight: 1,
            alignSelf: 'center',
          }}
        >+</button>
      ) : null}
    </div>
  );
}

function NewChildRow({ parentId, siblingOrderStart, onCreate, onCancel }) {
  const [text, setText] = useState('');
  const [count, setCount] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const commit = async () => {
    const t = text.trim();
    if (!t) { onCancel(); return; }
    const created = await createOngoing({
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
      alignItems: 'center',
      borderBottom: '1px solid #C9BB9A',
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

function NewOngoingRow({ onCreate }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const commit = async () => {
    const t = text.trim();
    if (!t) return;
    const created = await createOngoing({ text: t });
    onCreate(created);
    setText('');
    inputRef.current && inputRef.current.focus();
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 28px',
      alignItems: 'center',
      borderBottom: '1px solid #C9BB9A',
      background: '#FBF6E7',
    }}>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        placeholder="Add item..."
        style={{
          border: 'none', background: 'transparent', padding: '6px 8px', fontSize: 14, width: '100%',
          color: '#2D3436',
        }}
      />
      <div style={{ color: '#A89368', textAlign: 'center', fontSize: 16 }}>+</div>
    </div>
  );
}

export default function Ongoing({ ongoing, onChange, onDropTask, onDropNote }) {
  const list = Array.isArray(ongoing) ? ongoing : [];
  const [addingChildOf, setAddingChildOf] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleCreate = (n) => onChange([...list, n]);
  const handlePatch = (n) => onChange(list.map((x) => x.id === n.id ? n : x));
  const handleDelete = (id) =>
    onChange(list.filter((x) => x.id !== id && x.parent_id !== id));

  const handleDragStart = (e, item) => {
    const children = list
      .filter((n) => n.parent_id === item.id)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.id - b.id)
      .map((n) => ({ id: n.id, text: n.text }));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/x-planner-ongoing',
      JSON.stringify({ id: item.id, text: item.text, parent_id: item.parent_id, children })
    );
  };

  const incoming = (e) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes('application/x-planner-task')) return 'task';
    if (types.includes('application/x-planner-note')) return 'note';
    return null;
  };

  const handleDragOver = (e) => {
    if (!incoming(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOver) setDragOver(true);
  };
  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  };
  const handleDrop = (e) => {
    const kind = incoming(e);
    setDragOver(false);
    if (!kind) return;
    e.preventDefault();
    const mime = kind === 'task' ? 'application/x-planner-task' : 'application/x-planner-note';
    try {
      const payload = JSON.parse(e.dataTransfer.getData(mime));
      if (kind === 'task') onDropTask && onDropTask(payload);
      else onDropNote && onDropNote(payload);
    } catch (_) {}
  };

  const byOrder = (a, b) =>
    (a.order_index || 0) - (b.order_index || 0) || a.id - b.id;

  const topLevel = list.filter((n) => !n.parent_id).sort(byOrder);
  const childrenOf = (parentId) =>
    list.filter((n) => n.parent_id === parentId).sort(byOrder);

  const indent = async (itemId) => {
    const idx = topLevel.findIndex((n) => n.id === itemId);
    if (idx <= 0) return;
    const newParent = topLevel[idx - 1];
    const updated = await updateOngoing(itemId, { parent_id: newParent.id });
    handlePatch(updated);
  };

  const unindent = async (itemId) => {
    const updated = await updateOngoing(itemId, { parent_id: null });
    handlePatch(updated);
  };

  const handleAddChild = (parentId) => setAddingChildOf(parentId);

  const handleReorder = async (sourceId, targetId, position) => {
    const src = list.find((n) => n.id === sourceId);
    const tgt = list.find((n) => n.id === targetId);
    if (!src || !tgt) return;
    if (src.parent_id !== tgt.parent_id) return;

    const siblings = (src.parent_id == null ? topLevel : childrenOf(src.parent_id))
      .filter((n) => n.id !== sourceId);
    const tgtIdx = siblings.findIndex((n) => n.id === targetId);
    if (tgtIdx < 0) return;
    const insertAt = position === 'above' ? tgtIdx : tgtIdx + 1;
    const newSiblings = [
      ...siblings.slice(0, insertAt),
      src,
      ...siblings.slice(insertAt),
    ];
    const newIds = newSiblings.map((n) => n.id);
    onChange(list.map((n) => {
      const idx = newIds.indexOf(n.id);
      return idx >= 0 ? { ...n, order_index: idx } : n;
    }));
    try { await reorderOngoing(newIds); } catch (err) { console.error('reorderOngoing failed', err); }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        borderBottom: '1px solid #2D3436',
        marginTop: 28,
        background: dragOver ? 'rgba(201, 187, 154, 0.18)' : 'transparent',
        transition: 'background 100ms',
      }}
    >
      <div style={{
        fontStyle: 'italic',
        fontSize: 13,
        color: '#2D3436',
        textAlign: 'center',
        padding: '4px 0',
        borderBottom: '1px solid #2D3436',
        fontWeight: 500,
      }}>
        Ongoing
      </div>
      {topLevel.map((n) => {
        const kids = childrenOf(n.id);
        const nextOrder = kids.length
          ? (kids[kids.length - 1].order_index || 0) + 1
          : 0;
        return (
          <Fragment key={n.id}>
            <OngoingRow
              item={n}
              isChild={false}
              onPatch={handlePatch}
              onDelete={handleDelete}
              onIndent={indent}
              onUnindent={unindent}
              onAddChild={handleAddChild}
              onDragStart={handleDragStart}
              onReorder={handleReorder}
            />
            {kids.map((child) => (
              <OngoingRow
                key={child.id}
                item={child}
                isChild={true}
                onPatch={handlePatch}
                onDelete={handleDelete}
                onIndent={indent}
                onUnindent={unindent}
                onAddChild={handleAddChild}
                onDragStart={handleDragStart}
                onReorder={handleReorder}
              />
            ))}
            {addingChildOf === n.id ? (
              <NewChildRow
                parentId={n.id}
                siblingOrderStart={nextOrder}
                onCreate={handleCreate}
                onCancel={() => setAddingChildOf(null)}
              />
            ) : null}
          </Fragment>
        );
      })}
      <NewOngoingRow onCreate={handleCreate} />
    </div>
  );
}
