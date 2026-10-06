import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SocialCard from './SocialCard';
import { tableWrap, table, th, thNum, headRow, td, tdNum, tableLink } from './SocialTable';
import { API_BASE } from '../shared/api';
import { getCompetitors, changeCompetitor, putCompetitorSettings, saveCompetitorVideo, unsaveCompetitorVideo } from './api';
import { leaderboardRows, sortRows, TYPE_LABEL, TEXT_COLUMNS } from './competitorRows';
import { monthDay, dateTime, multipleText } from './format';
import { COLORS, outlineButton } from '../shared/styles';
import { num } from '../shared/format';

const PICK_KEY = 'planner.social.competitorPick';
const muted = { color: COLORS.muted, fontSize: 13 };

// 562300 -> '562K', 1234567 -> '1.2M'
export const compact = (v) => {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (n >= 1e6) return `${num(n / 1e6, n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${num(n / 1e3, 0)}K`;
  if (n >= 1e3) return `${num(n / 1e3, 1)}K`;
  return num(n);
};
export const perK = (v) => (v === null || v === undefined ? '-' : num(v, 1));
export const secs = (d) => (d ? `${Math.round(d)} s` : null);

function readPick() { try { return localStorage.getItem(PICK_KEY); } catch (_) { return null; } }
function writePick(v) { try { localStorage.setItem(PICK_KEY, v); } catch (_) { /* ignore */ } }

function soundText(s) {
  if (!s) return '-';
  return s.original ? 'original' : (s.title || 'sound');
}

export function Pill({ active, onClick, children, title }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      border: `1px solid ${active ? COLORS.accent : COLORS.hairline}`, background: active ? COLORS.todayCell : COLORS.paper,
      color: active ? COLORS.calloutText : COLORS.ink, borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600,
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

function Star({ on, onClick }) {
  return (
    <button type="button" onClick={onClick} title={on ? 'Saved; click to remove' : 'Save to the board'} style={{
      border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: on ? COLORS.warn : COLORS.faint, padding: 0,
    }}>{on ? '★' : '☆'}</button>
  );
}

const SORT_KEY = 'planner.social.competitorSort';
const COLS_KEY = 'planner.social.competitorCols';
// [key, header, numeric, shown by default]
const COLUMNS = [
  ['account', 'Account', false, true],
  ['posted', 'Posted', false, true],
  ['move', 'Move', false, true],
  ['format', 'Format', false, true],
  ['sound', 'Sound', false, false],
  ['multiple', 'Multiple', true, true],
  ['saves', 'Saves/1k', true, true],
  ['shares', 'Shares/1k', true, true],
  ['views', 'Views', true, true],
  ['type', 'Type', false, true],
];

function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...JSON.parse(raw) } : fallback; } catch (_) { return fallback; }
}
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* ignore */ } }

export const TYPE_STYLE = {
  outlier: { background: COLORS.page, color: COLORS.muted },
  rising: { background: '#E7F5EC', color: '#2E7D4F' },
  popular: { background: COLORS.todayCell, color: COLORS.calloutText },
  adjacent: { background: COLORS.page, color: COLORS.faint },
};

// The video's cover from the server's cache, 9:16, linking to the video; a neutral tile when the
// cover is not cached yet.
export function Cover({ v, width = 34 }) {
  const box = { display: 'block', width, aspectRatio: '9 / 16', borderRadius: 5, overflow: 'hidden', background: COLORS.hairline, flex: 'none' };
  return (
    <a href={v.url} target="_blank" rel="noreferrer" style={box} title="Open on TikTok">
      {v.has_thumb
        ? <img src={`${API_BASE}/social/thumb/${v.video_id}`} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 9, color: COLORS.muted }}>{v.multiple ? `${num(v.multiple, 0)}x` : ''}</span>}
    </a>
  );
}

function MultipleCell({ v }) {
  if (v.multiple !== null && v.multiple !== undefined) return <span style={{ fontWeight: 600 }}>{multipleText(v.multiple, v.gap)}</span>;
  if (v.early_multiple) return <span style={{ color: '#2E7D4F' }} title="Under 7 days old: views so far against the account's usual views">{num(v.early_multiple, 1)}x early</span>;
  return '-';
}

const CELL = {
  account: (v) => <span style={{ color: COLORS.accent, fontWeight: 600 }}>@{v.handle}</span>,
  posted: (v) => monthDay(v.date_posted),
  move: (v) => <em style={{ color: COLORS.muted }}>{v.move || ''}</em>,
  format: (v) => <span style={{ color: COLORS.muted }}>{[v.format, v.text_overlay ? 'text overlay' : null, secs(v.duration)].filter(Boolean).join(', ')}</span>,
  sound: (v) => <span style={{ color: COLORS.muted }} title={v.sound ? `${v.sound.title || ''}${v.sound.author ? ` by ${v.sound.author}` : ''}` : ''}>{soundText(v.sound)}</span>,
  multiple: (v) => <MultipleCell v={v} />,
  saves: (v) => perK(v.saves_per_k),
  shares: (v) => perK(v.shares_per_k),
  views: (v) => <span title={v.views_per_day !== null && v.views_per_day !== undefined ? `${num(v.views_per_day)} views a day lately` : ''}>{compact(v.views)}</span>,
  type: (v) => <span title={v.type === 'adjacent' ? 'A nearby topic, not core to your niche (niche score 1 of 3)' : undefined} style={{ ...TYPE_STYLE[v.type], fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap' }}>{TYPE_LABEL[v.type]}</span>,
};

// The leaderboard: one sortable table, a cover on every row; sort and visible columns are remembered.
function Leaderboard({ rows, onToggleSave, onNote, notes = false }) {
  const [sort, setSort] = useState(() => readJson(SORT_KEY, { key: 'multiple', dir: -1 }));
  const [cols, setCols] = useState(() => readJson(COLS_KEY, Object.fromEntries(COLUMNS.map(([k, , , on]) => [k, on]))));
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);
  const shown = COLUMNS.filter(([k]) => cols[k]);
  const pickSort = (key) => {
    const next = sort.key === key ? { key, dir: -sort.dir } : { key, dir: TEXT_COLUMNS.includes(key) ? 1 : -1 };
    setSort(next);
    writeJson(SORT_KEY, next);
  };
  const toggleCol = (key) => { const next = { ...cols, [key]: !cols[key] }; setCols(next); writeJson(COLS_KEY, next); };
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
        {COLUMNS.map(([k, label]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" id={`competitor-col-${k}`} checked={Boolean(cols[k])} onChange={() => toggleCol(k)} />{label}
          </label>
        ))}
      </div>
      {sorted.length ? (
        <div style={tableWrap}>
          <table style={{ ...table, minWidth: 860 }}>
            <thead>
              <tr style={headRow}>
                <th style={th} />
                <th style={{ ...th, minWidth: 220 }}>Opening line</th>
                {shown.map(([k, label, numeric]) => (
                  <th key={k} onClick={() => pickSort(k)} style={{ ...(numeric ? thNum : th), cursor: 'pointer', color: sort.key === k ? COLORS.accent : undefined }}>
                    {label}{sort.key === k ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
                {notes ? <th style={th}>Note</th> : null}
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <tr key={v.video_id}>
                  <td style={{ ...td, width: 34 }}><Cover v={v} /></td>
                  <td style={{ ...td, maxWidth: 380 }}>
                    <a href={v.url} target="_blank" rel="noreferrer" style={{ ...tableLink, fontWeight: 500, color: COLORS.ink }}>{v.hook || v.caption || '(no opening line)'}</a>
                  </td>
                  {shown.map(([k, , numeric]) => <td key={k} style={numeric ? tdNum : { ...td, whiteSpace: k === 'format' || k === 'sound' ? 'normal' : 'nowrap' }}>{CELL[k](v)}</td>)}
                  {notes ? (
                    <td style={td}>
                      <input defaultValue={v.note || ''} placeholder="Note" aria-label="Note" id={`competitor-note-${v.video_id}`} onBlur={(e) => onNote(v, e.target.value)}
                        style={{ width: 180, border: `1px solid ${COLORS.hairline}`, borderRadius: 8, padding: '4px 8px', fontSize: 12 }} />
                    </td>
                  ) : null}
                  <td style={{ ...td, textAlign: 'center' }}><Star on={v.saved} onClick={() => onToggleSave(v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div style={muted}>No videos here yet.</div>}
    </>
  );
}

function AccountLine({ a, onRemove }) {
  const stats = [
    a.followers ? `${compact(a.followers)} followers` : null,
    a.band,
    `${a.posts_90d} posts in 90 days`,
    a.median_views_90d !== null ? `median ${compact(a.median_views_90d)} views` : null,
    a.off_niche_hidden ? `${a.off_niche_hidden} off-niche hidden` : null,
  ].filter(Boolean).join(' · ');
  const pending = [a.hooks_pending ? `${a.hooks_pending} waiting for a hook read` : null, a.unscored ? `${a.unscored} waiting for a niche score` : null].filter(Boolean).join(', ');
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}>
          <a href={`https://www.tiktok.com/@${a.handle}`} target="_blank" rel="noreferrer" style={tableLink}>@{a.handle}</a>
          <span style={{ color: COLORS.muted }}> {'·'} {stats}</span>
        </div>
        <button type="button" onClick={() => onRemove(a.handle)} style={outlineButton(COLORS.muted, { small: true })}>Remove</button>
      </div>
      {!a.deep_walked_at ? <div style={{ ...muted, marginTop: 6 }}>Waiting for the first listing (the Mac lists new accounts at 06:30, 12:15 and 18:15).</div> : null}
      {pending ? <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{pending}.</div> : null}
    </div>
  );
}

// The Competitors card: one leaderboard over every account's videos (or one account, or Saved), with
// covers. The user adds every account.
export default function CompetitorsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pick, setPick] = useState(readPick() || 'all');
  const [notice, setNotice] = useState(null);
  const [handle, setHandle] = useState('');
  const [editing, setEditing] = useState(false);   // the niche editor is open
  const [draft, setDraft] = useState('');

  const load = useCallback(() => getCompetitors().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const choose = (v) => { setPick(v); writePick(v); };

  const add = async (e) => {
    e.preventDefault();
    setNotice(null);
    const r = await changeCompetitor(handle, 'add');
    if (r.status !== 200) { setNotice(r.error); return; }
    setHandle('');
    choose(r.handle);
    load();
  };
  const remove = async (h) => { const r = await changeCompetitor(h, 'remove'); if (r.status !== 200) setNotice(r.error); load(); };
  const toggleSave = async (v) => { if (v.saved) await unsaveCompetitorVideo(v.video_id); else await saveCompetitorVideo(v.video_id, null); load(); };
  const saveNote = async (v, note) => { if ((v.note || '') !== note) { await saveCompetitorVideo(v.video_id, note); load(); } };
  const startEdit = () => {
    if (editing) { setEditing(false); return; }
    setEditing(true);
    setDraft(data.niche);
  };
  const saveEdit = async () => {
    const r = await putCompetitorSettings({ niche: draft });
    if (r.status !== 200) { setNotice(r.error); return; }
    setEditing(false);
    load();
  };

  const actions = data ? (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" onClick={startEdit} style={outlineButton(COLORS.muted, { small: true })}>Niche</button>
      <form onSubmit={add} style={{ display: 'flex', gap: 6 }}>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" aria-label="Add a TikTok handle"
          style={{ width: 120, border: `1px solid ${COLORS.hairline}`, borderRadius: 8, padding: '4px 8px', fontSize: 12 }} />
        <button type="submit" disabled={!handle.trim()} style={outlineButton(COLORS.accent, { small: true, disabled: !handle.trim() })}>Add</button>
      </form>
    </span>
  ) : null;

  if (error) return <SocialCard title="Competitors"><div style={{ color: COLORS.danger, fontSize: 13 }}>Error: {error}</div></SocialCard>;
  if (!data) return <SocialCard title="Competitors"><div style={muted}>Loading...</div></SocialCard>;

  const accounts = data.accounts || [];
  const handles = accounts.map((a) => a.handle);
  const current = pick === 'saved' || pick === 'all' || handles.includes(pick) ? pick : 'all';
  const account = accounts.find((a) => a.handle === current);
  const run = data.last_run;
  const rows = leaderboardRows(accounts, current);

  return (
    <SocialCard title="Competitors" actions={actions}>
      {notice ? <div style={{ fontSize: 13, color: COLORS.danger, marginBottom: 8 }}>{notice}</div> : null}
      {editing ? (
        <div style={{ marginBottom: 12 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.hairline}`, borderRadius: 8, padding: 8, fontSize: 13, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button type="button" onClick={saveEdit} style={outlineButton(COLORS.accent, { small: true })}>Save</button>
            <button type="button" onClick={() => setEditing(false)} style={outlineButton(COLORS.muted, { small: true })}>Cancel</button>
            <span style={{ fontSize: 11, color: COLORS.muted, alignSelf: 'center' }}>Changing the niche rescores every video.</span>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <Pill active={current === 'all'} onClick={() => choose('all')}>All</Pill>
        {accounts.map((a) => (
          <Pill key={a.handle} active={current === a.handle} onClick={() => choose(a.handle)} title={a.band ? `${a.band} your size` : ''}>
            @{a.handle}{a.band ? <span style={{ fontWeight: 400, color: COLORS.muted }}> {a.band}</span> : null}
          </Pill>
        ))}
        <Pill active={current === 'saved'} onClick={() => choose('saved')}>Saved ({data.saved.length})</Pill>
      </div>

      {!data.available ? <div style={muted}>The tracker's research database is not on this server yet.</div> : null}
      {data.available && account ? <AccountLine a={account} onRemove={remove} /> : null}
      {data.available && current === 'saved' ? (
        <Leaderboard rows={data.saved.map((v) => ({ ...v, type: v.multiple !== null ? 'outlier' : 'popular' }))} onToggleSave={toggleSave} onNote={saveNote} notes />
      ) : null}
      {data.available && current !== 'saved' ? <Leaderboard rows={rows} onToggleSave={toggleSave} onNote={saveNote} /> : null}

      <div style={{ fontSize: 11, color: COLORS.faint, marginTop: 16 }}>
        Crawled {data.updated_at ? dateTime(data.updated_at) : 'never'}{run && run.finished_at ? `, analyzed ${dateTime(run.finished_at)}` : ''}{run && run.error ? ` (last analysis failed: ${run.error})` : ''}. Your followers: {compact(data.own_followers)}.
      </div>
    </SocialCard>
  );
}
