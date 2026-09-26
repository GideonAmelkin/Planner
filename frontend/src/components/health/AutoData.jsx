import React, { useState } from 'react';
import Sparkline from './Sparkline';
import { G, statValue, statLabel } from '../../garminTheme';
import { num } from '../../utils/garminFormat';

// Generic Garmin-style rendering of any endpoint payload:
//   [[ts, value], ...]  -> sparkline
//   [ {..}, {..} ]      -> table of the primitive columns
//   { .. }              -> key / value grid, nested arrays and objects beneath
// Keys that are ids or bookkeeping are hidden.

const HIDE = /(^id$|Id$|Pk$|PK$|^uuid$|userProfile|^rule$|^privacy$|ProfileImage|^ownerDisplayName$|^userRoles$|DescriptorDTOList|ValueDescriptors)/;
const MAX_ROWS = 50;
const MAX_COLS = 8;

export const humanize = (k) => String(k)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b(gmt|hr|bpm|vo2|spo2|hrv|bmi|km)\b/gi, (m) => m.toUpperCase())
  .replace(/^./, (c) => c.toUpperCase());

const isPrim = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const isPairSeries = (v) => Array.isArray(v) && v.length > 1 && v.every((p) => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && (p[1] === null || typeof p[1] === 'number'));
const isEmpty = (v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

function fmt(v, key = '') {
  if (v === null || v === undefined || v === '') return '--';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    if (/timestamp|Gmt|Local|^from$|^until$|Date$|^date$/i.test(key) && v > 1e11) return new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    if (/seconds$/i.test(key)) { const h = Math.floor(v / 3600); const m = Math.round((v % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; }
    if (/meters$/i.test(key)) return `${num(v / 1609.344, 2)} mi`;
    return Number.isInteger(v) ? num(v) : num(v, 2);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16).replace('T', ' ');
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

function KeyValues({ obj }) {
  const entries = Object.entries(obj).filter(([k, v]) => isPrim(v) && !HIDE.test(k));
  if (!entries.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px 16px' }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ minWidth: 0 }}>
          <div style={{ ...statValue, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(v)}>{fmt(v, k)}</div>
          <div style={statLabel}>{humanize(k)}</div>
        </div>
      ))}
    </div>
  );
}

function Table({ rows }) {
  const sample = rows.find((r) => r && typeof r === 'object') || {};
  const cols = Object.keys(sample).filter((k) => isPrim(sample[k]) && !HIDE.test(k)).slice(0, MAX_COLS);
  if (!cols.length) return <div style={{ color: G.muted, fontSize: 12 }}>{rows.length} items</div>;
  const shown = rows.slice(0, MAX_ROWS);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {cols.map((c) => <th key={c} style={{ textAlign: 'left', padding: '6px 10px 6px 0', fontSize: 11, fontWeight: 400, color: G.muted, borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap' }}>{humanize(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => <td key={c} style={{ padding: '7px 10px 7px 0', borderBottom: `1px solid ${G.border}`, whiteSpace: 'nowrap', fontWeight: 300 }}>{fmt(r[c], c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length ? <div style={{ fontSize: 11, color: G.muted, marginTop: 6 }}>Showing {shown.length} of {rows.length}</div> : null}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: G.text, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Value({ value, depth = 0, label, color }) {
  if (isEmpty(value)) return <div style={{ fontSize: 18, fontWeight: 300, color: G.muted }}>No data</div>;
  if (isPairSeries(value)) return <Sparkline points={value.filter((p) => p[1] !== null)} color={color || G.blue} />;
  if (Array.isArray(value)) {
    if (value.every(isPrim)) return <div style={{ fontWeight: 300 }}>{value.map((v) => fmt(v)).join(', ')}</div>;
    return <Table rows={value} />;
  }
  if (typeof value === 'object') {
    const nested = Object.entries(value).filter(([k, v]) => !isPrim(v) && !HIDE.test(k) && !isEmpty(v));
    return (
      <>
        <KeyValues obj={value} />
        {depth < 2 ? nested.map(([k, v]) => (
          <Section key={k} label={humanize(k)}><Value value={v} depth={depth + 1} color={color} /></Section>
        )) : null}
      </>
    );
  }
  return <div style={{ fontSize: 48, fontWeight: 300 }}>{fmt(value, label)}</div>;
}

export default function AutoData({ value, color }) {
  const [json, setJson] = useState(false);
  return (
    <div>
      <Value value={value} color={color} />
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button type="button" onClick={() => setJson((j) => !j)} style={{ background: 'transparent', border: 'none', color: G.blue, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', fontFamily: G.font }}>
          {json ? 'Hide JSON ⌃' : 'View JSON ⌄'}
        </button>
      </div>
      {json ? (
        <pre style={{ margin: '4px 0 0', padding: 10, background: G.surface2, border: `1px solid ${G.border}`, borderRadius: 4, fontSize: 11, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
