import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SocialCard from './SocialCard';
import { tableWrap, table, th, thNum, headRow, td, tdNum, tableLink, blockLabel } from './SocialTable';
import { getCompetitors, changeCompetitor, putCompetitorSettings, saveCompetitorVideo, unsaveCompetitorVideo } from './api';
import { monthDay, shortDate, dateTime, multipleText } from './format';
import { COLORS, outlineButton } from '../shared/styles';
import { num } from '../shared/format';

const PICK_KEY = 'planner.social.competitorPick';
const muted = { color: COLORS.muted, fontSize: 13 };

// 562300 -> '562K', 1234567 -> '1.2M'
const compact = (v) => {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (n >= 1e6) return `${num(n / 1e6, n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${num(n / 1e3, 0)}K`;
  if (n >= 1e3) return `${num(n / 1e3, 1)}K`;
  return num(n);
};
const perK = (v) => (v === null || v === undefined ? '-' : num(v, 1));
const secs = (d) => (d ? `${Math.round(d)} s` : null);

function readPick() { try { return localStorage.getItem(PICK_KEY); } catch (_) { return null; } }
function writePick(v) { try { localStorage.setItem(PICK_KEY, v); } catch (_) { /* ignore */ } }

// "Confession, talking head, text overlay, 45 s"
function recipe(v) {
  return [v.format, v.text_overlay ? 'text overlay' : null, secs(v.duration)].filter(Boolean).join(', ');
}

function soundText(s) {
  if (!s) return '-';
  return s.original ? 'original' : (s.title || 'sound');
}

function Pill({ active, onClick, children, title }) {
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

// Hook line linked to the video, ending in its move in italics; the recipe underneath.
function HookCell({ v }) {
  return (
    <td style={td}>
      <a href={v.url} target="_blank" rel="noreferrer" style={{ ...tableLink, fontWeight: 500, color: COLORS.ink }}>
        {v.hook || v.caption || '(no opening line)'}
      </a>
      {v.move ? <em style={{ color: COLORS.muted, fontWeight: 400, fontSize: 12, marginLeft: 6 }}>{v.move}</em> : null}
      {recipe(v) ? <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{recipe(v)}</div> : null}
    </td>
  );
}

const SORTS = {
  multiple: (v) => v.multiple || 0,
  saves_per_k: (v) => v.saves_per_k || 0,
  shares_per_k: (v) => v.shares_per_k || 0,
  views: (v) => v.views || 0,
};

function OutlierTable({ rows, onToggleSave, showHandle = false }) {
  const [sort, setSort] = useState('multiple');
  const sorted = useMemo(() => [...rows].sort((a, b) => SORTS[sort](b) - SORTS[sort](a)), [rows, sort]);
  const head = (key, label, title) => (
    <th style={{ ...thNum, cursor: 'pointer', color: sort === key ? COLORS.accent : undefined }} title={title} onClick={() => setSort(key)}>{label}</th>
  );
  return (
    <div style={tableWrap}>
      <table style={{ ...table, minWidth: 760 }}>
        <thead>
          <tr style={headRow}>
            <th style={th}>Posted</th>
            {showHandle ? <th style={th}>Account</th> : null}
            <th style={{ ...th, width: '40%' }}>Opening line</th>
            <th style={th}>Sound</th>
            {head('multiple', 'Multiple', 'Views relative to the account\'s own last 20 posts; 1.0x is normal')}
            {head('saves_per_k', 'Saves/1k')}
            {head('shares_per_k', 'Shares/1k')}
            {head('views', 'Views')}
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => (
            <tr key={v.video_id}>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{monthDay(v.date_posted)}</td>
              {showHandle ? <td style={{ ...td, whiteSpace: 'nowrap' }}>@{v.handle}</td> : null}
              <HookCell v={v} />
              <td style={{ ...td, fontSize: 12, color: COLORS.muted, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.sound ? `${v.sound.title || ''} ${v.sound.author ? `by ${v.sound.author}` : ''}` : ''}>{soundText(v.sound)}</td>
              <td style={{ ...tdNum, fontWeight: 600 }}>{multipleText(v.multiple, v.gap)}</td>
              <td style={tdNum}>{perK(v.saves_per_k)}</td>
              <td style={tdNum}>{perK(v.shares_per_k)}</td>
              <td style={tdNum} title={v.views_per_day !== null ? `${num(v.views_per_day)} views a day lately` : ''}>{compact(v.views)}</td>
              <td style={{ ...td, textAlign: 'center' }}><Star on={v.saved} onClick={() => onToggleSave(v)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountPanel({ a, onToggleSave, onRemove }) {
  const [openAdjacent, setOpenAdjacent] = useState(false);
  const stats = [
    a.followers ? `${compact(a.followers)} followers` : null,
    a.band,
    `${a.posts_90d} posts in 90 days`,
    a.median_views_90d !== null ? `median ${compact(a.median_views_90d)} views` : null,
    a.off_niche_hidden ? `${a.off_niche_hidden} off-niche hidden` : null,
  ].filter(Boolean).join(' · ');
  const waiting = !a.deep_walked_at;
  const pending = [a.hooks_pending ? `${a.hooks_pending} waiting for a hook read` : null, a.unscored ? `${a.unscored} waiting for a niche score` : null].filter(Boolean).join(', ');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}>
          <a href={`https://www.tiktok.com/@${a.handle}`} target="_blank" rel="noreferrer" style={tableLink}>@{a.handle}</a>
          <span style={{ color: COLORS.muted }}> {'·'} {stats}</span>
        </div>
        <button type="button" onClick={() => onRemove(a.handle)} style={outlineButton(COLORS.muted, { small: true })}>Remove</button>
      </div>
      {waiting ? <div style={{ ...muted, marginTop: 8 }}>Waiting for the first crawl (one new account a day, 09:30).</div> : null}
      {a.last_cut_at && (!a.last_walk_at || a.last_cut_at >= a.last_walk_at) ? <div style={{ fontSize: 12, color: COLORS.warn, marginTop: 6 }}>TikTok cut the last profile load ({dateTime(a.last_cut_at)}); retried tomorrow.</div> : null}
      {pending ? <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>{pending}.</div> : null}

      <div style={blockLabel}>Top outliers, last 90 days</div>
      {a.outliers.length ? <OutlierTable rows={a.outliers} onToggleSave={onToggleSave} /> : <div style={muted}>None yet.</div>}

      {a.rising.length ? (
        <>
          <div style={blockLabel}>Rising (under 7 days, early)</div>
          {a.rising.slice(0, 4).map((v) => (
            <div key={v.video_id} style={{ fontSize: 13, padding: '4px 0' }}>
              <a href={v.url} target="_blank" rel="noreferrer" style={{ ...tableLink, color: COLORS.ink, fontWeight: 500 }}>{v.hook || v.caption}</a>
              <span style={{ color: COLORS.muted }}> {'·'} {compact(v.views)} views in {num(v.age_days, 1)} days{v.early_multiple ? ` (${num(v.early_multiple, 1)}x their usual already)` : ''}</span>
            </div>
          ))}
        </>
      ) : null}

      {a.ideas.length ? (
        <>
          <div style={blockLabel}>Ideas from comments</div>
          {a.ideas.map((c, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', display: 'flex', gap: 8 }}>
              <span style={{ color: COLORS.muted, whiteSpace: 'nowrap', minWidth: 64 }}>{c.tag}</span>
              <span style={{ minWidth: 0 }}>"{c.text}" <span style={{ color: COLORS.muted }}>{compact(c.likes)} likes</span></span>
            </div>
          ))}
        </>
      ) : null}

      {a.popular.length ? (
        <>
          <div style={blockLabel}>All-time hits</div>
          {a.popular.map((v) => (
            <div key={v.video_id} style={{ fontSize: 13, padding: '4px 0', display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: COLORS.muted, whiteSpace: 'nowrap', minWidth: 64 }}>{shortDate(v.date_posted).replace(/^\w+, /, '')}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <a href={v.url} target="_blank" rel="noreferrer" style={{ ...tableLink, color: COLORS.ink, fontWeight: 500 }}>{v.hook || v.caption}</a>
                {v.move ? <em style={{ color: COLORS.muted, fontSize: 12, marginLeft: 6 }}>{v.move}</em> : null}
              </span>
              <span style={{ color: COLORS.muted, whiteSpace: 'nowrap' }}>{compact(v.views)}</span>
              <Star on={v.saved} onClick={() => onToggleSave(v)} />
            </div>
          ))}
        </>
      ) : null}

      {a.adjacent.length ? (
        <>
          <button type="button" onClick={() => setOpenAdjacent(!openAdjacent)} style={{ ...blockLabel, display: 'block', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
            {openAdjacent ? '▾' : '▸'} Adjacent ({a.adjacent.length})
          </button>
          {openAdjacent ? <OutlierTable rows={a.adjacent} onToggleSave={onToggleSave} /> : null}
        </>
      ) : null}
    </div>
  );
}

function ProposedPanel({ proposed, onDecide }) {
  if (!proposed.length) return <div style={muted}>No proposals yet. Discovery reads the niche hashtags every Sunday.</div>;
  return proposed.map((p) => (
    <div key={p.handle} style={{ padding: '10px 0', borderBottom: `1px solid ${COLORS.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}>
          <a href={`https://www.tiktok.com/@${p.handle}`} target="_blank" rel="noreferrer" style={tableLink}>@{p.handle}</a>
          <span style={{ color: COLORS.muted }}> {'·'} {compact(p.followers)} followers {'·'} {p.band} {'·'} {p.tags.map((t) => `#${t}`).join(' ')}</span>
        </div>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => onDecide(p.handle, 'approve')} style={outlineButton(COLORS.accent, { small: true })}>Approve</button>
          <button type="button" onClick={() => onDecide(p.handle, 'dismiss')} style={outlineButton(COLORS.muted, { small: true })}>Dismiss</button>
        </span>
      </div>
      {p.videos.map((v) => (
        <div key={v.video_id} style={{ fontSize: 13, padding: '4px 0 0' }}>
          <a href={v.url} target="_blank" rel="noreferrer" style={{ ...tableLink, color: COLORS.ink, fontWeight: 500 }}>{v.hook || v.caption}</a>
          {v.move ? <em style={{ color: COLORS.muted, fontSize: 12, marginLeft: 6 }}>{v.move}</em> : null}
          <span style={{ color: COLORS.muted }}> {'·'} {compact(v.views)} views, {num(v.views_per_follower, 1)}x followers</span>
        </div>
      ))}
    </div>
  ));
}

function SavedPanel({ saved, onToggleSave, onNote }) {
  if (!saved.length) return <div style={muted}>Nothing saved. Use the star on any row.</div>;
  return saved.map((v) => (
    <div key={v.video_id} style={{ padding: '8px 0', borderBottom: `1px solid ${COLORS.hairline}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
      <div style={{ minWidth: 0, fontSize: 13 }}>
        <div>
          <span style={{ color: COLORS.muted }}>@{v.handle} {'·'} {monthDay(v.date_posted)} {'·'} </span>
          <a href={v.url} target="_blank" rel="noreferrer" style={{ ...tableLink, color: COLORS.ink, fontWeight: 500 }}>{v.hook || v.caption}</a>
          {v.move ? <em style={{ color: COLORS.muted, fontSize: 12, marginLeft: 6 }}>{v.move}</em> : null}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
          {[recipe(v), v.sound ? `sound: ${soundText(v.sound)}` : null, v.multiple !== null ? multipleText(v.multiple, v.gap) : null].filter(Boolean).join(' · ')}
        </div>
        <input defaultValue={v.note || ''} placeholder="Note" onBlur={(e) => onNote(v, e.target.value)}
          style={{ marginTop: 6, width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.hairline}`, borderRadius: 8, padding: '5px 8px', fontSize: 13 }} />
      </div>
      <Star on onClick={() => onToggleSave(v)} />
    </div>
  ));
}

// The Competitors card: one account at a time behind pills, plus Proposed (discovery) and Saved.
export default function CompetitorsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pick, setPick] = useState(readPick());
  const [notice, setNotice] = useState(null);
  const [handle, setHandle] = useState('');
  const [editing, setEditing] = useState(null);   // null | 'niche' | 'tags'
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
  const decide = async (h, action) => { const r = await changeCompetitor(h, action); if (r.status !== 200) setNotice(r.error); load(); };
  const remove = (h) => decide(h, 'remove');
  const toggleSave = async (v) => { if (v.saved) await unsaveCompetitorVideo(v.video_id); else await saveCompetitorVideo(v.video_id, null); load(); };
  const saveNote = async (v, note) => { if ((v.note || '') !== note) { await saveCompetitorVideo(v.video_id, note); load(); } };
  const startEdit = (what) => {
    if (editing === what) { setEditing(null); return; }
    setEditing(what);
    setDraft(what === 'niche' ? data.niche : data.tags.map((t) => `#${t}`).join(' '));
  };
  const saveEdit = async () => {
    const r = await putCompetitorSettings(editing === 'niche' ? { niche: draft } : { tags: draft });
    if (r.status !== 200) { setNotice(r.error); return; }
    setEditing(null);
    load();
  };

  const actions = data ? (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" onClick={() => startEdit('niche')} style={outlineButton(COLORS.muted, { small: true })}>Niche</button>
      <button type="button" onClick={() => startEdit('tags')} style={outlineButton(COLORS.muted, { small: true })}>Tags</button>
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
  const current = pick === 'proposed' || pick === 'saved' ? pick : (handles.includes(pick) ? pick : handles[0] || 'proposed');
  const account = accounts.find((a) => a.handle === current);
  const moves = data.winning.moves.map(([m, n]) => `${m} ${n}`).join(', ');
  const formats = data.winning.formats.map(([f, n]) => `${f} ${n}`).join(', ');
  const run = data.last_run;

  return (
    <SocialCard title="Competitors" actions={actions}>
      {notice ? <div style={{ fontSize: 13, color: COLORS.danger, marginBottom: 8 }}>{notice}</div> : null}
      {editing ? (
        <div style={{ marginBottom: 12 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={editing === 'niche' ? 3 : 2}
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.hairline}`, borderRadius: 8, padding: 8, fontSize: 13, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button type="button" onClick={saveEdit} style={outlineButton(COLORS.accent, { small: true })}>Save</button>
            <button type="button" onClick={() => setEditing(null)} style={outlineButton(COLORS.muted, { small: true })}>Cancel</button>
            <span style={{ fontSize: 11, color: COLORS.muted, alignSelf: 'center' }}>{editing === 'niche' ? 'Changing the niche rescores every video.' : 'Discovery reads these hashtags every Sunday.'}</span>
          </div>
        </div>
      ) : null}

      {moves || formats || data.rising_sounds.length ? (
        <div style={{ fontSize: 13, marginBottom: 12, display: 'grid', gap: 4 }}>
          {moves ? <div><span style={{ color: COLORS.muted }}>Winning moves: </span>{moves}</div> : null}
          {formats ? <div><span style={{ color: COLORS.muted }}>Formats: </span>{formats}</div> : null}
          {data.rising_sounds.slice(0, 3).map((s) => (
            <div key={s.id}><span style={{ color: COLORS.muted }}>Rising sound: </span>{s.title || 'untitled'}{s.author ? ` by ${s.author}` : ''} <span style={{ color: COLORS.muted }}>({s.handles.map((h) => `@${h}`).join(', ')})</span></div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {accounts.map((a) => (
          <Pill key={a.handle} active={current === a.handle} onClick={() => choose(a.handle)} title={a.band ? `${a.band} your size` : ''}>
            @{a.handle}{a.band ? <span style={{ fontWeight: 400, color: COLORS.muted }}> {a.band}</span> : null}
          </Pill>
        ))}
        <Pill active={current === 'proposed'} onClick={() => choose('proposed')}>Proposed ({data.proposed.length})</Pill>
        <Pill active={current === 'saved'} onClick={() => choose('saved')}>Saved ({data.saved.length})</Pill>
      </div>

      {!data.available ? <div style={muted}>The tracker's research database is not on this server yet.</div> : null}
      {data.available && account ? <AccountPanel a={account} onToggleSave={toggleSave} onRemove={remove} /> : null}
      {data.available && current === 'proposed' ? <ProposedPanel proposed={data.proposed} onDecide={decide} /> : null}
      {data.available && current === 'saved' ? <SavedPanel saved={data.saved} onToggleSave={toggleSave} onNote={saveNote} /> : null}

      <div style={{ fontSize: 11, color: COLORS.faint, marginTop: 16 }}>
        Crawled {data.updated_at ? dateTime(data.updated_at) : 'never'}{run && run.finished_at ? `, analyzed ${dateTime(run.finished_at)}` : ''}{run && run.error ? ` (last analysis failed: ${run.error})` : ''}. Your followers: {compact(data.own_followers)}.
      </div>
    </SocialCard>
  );
}
