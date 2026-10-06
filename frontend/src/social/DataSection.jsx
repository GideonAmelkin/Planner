import React, { useEffect, useMemo, useState } from 'react';
import SocialCard from './SocialCard';
import SocialTile, { tileGrid, tableWrap, table, th, thNum, headRow, td, tdNum, tableLink } from './SocialTable';
import { getSocialVideo } from './api';
import { shortDate, dateTime, multipleText, count } from './format';
import { COLORS, outlineButton } from '../shared/styles';
import { num } from '../shared/format';

export const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1XQocZ1-cCv-i-6NwtBvgB2isWFnrGj45WbAH357JjyQ';
const PAGE = 100;

// The sheet's columns, in the sheet's order. `num` columns sort numerically and align right.
const COLUMNS = [
  { key: 'date_posted', label: 'Date Posted', sort: 'text' },
  { key: 'video_id', label: 'Video ID' },
  { key: 'username', label: 'Username' },
  { key: 'caption', label: 'Caption' },
  { key: 'views', label: 'Views', sort: 'num' },
  { key: 'likes', label: 'Likes', sort: 'num' },
  { key: 'comments', label: 'Comments', sort: 'num' },
  { key: 'saves', label: 'Saves', sort: 'num' },
  { key: 'shares', label: 'Shares', sort: 'num' },
  { key: 'hook_summary', label: 'Hook Summary' },
  { key: 'url', label: 'URL' },
  { key: 'multiple', label: 'Multiple', sort: 'num' },
  { key: 'script', label: 'Script' },
];

const clamp = (max) => ({ maxWidth: max, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const mutedCell = { ...td, color: COLORS.muted, fontSize: 12, whiteSpace: 'nowrap' };

function compare(a, b, key, kind, dir) {
  const av = a[key]; const bv = b[key];
  const aNull = av === null || av === undefined || av === ''; const bNull = bv === null || bv === undefined || bv === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1;          // blanks sink whatever the direction
  if (bNull) return -1;
  const r = kind === 'num' ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
  return dir === 'asc' ? r : -r;
}

// Every column of the tracker's videos table, searchable and sortable; a click on a row
// opens the full caption, hook and transcript (fetched then).
const OPEN_KEY = 'planner.social.dataOpen';

export default function DataSection({ data, loading, error }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'date_posted', dir: 'desc' });
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(null);
  // The card folds behind a chevron, closed by default; remembered per browser.
  const [cardOpen, setCardOpen] = useState(() => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch (_) { return false; } });
  const toggleCard = () => setCardOpen((o) => { try { localStorage.setItem(OPEN_KEY, o ? '0' : '1'); } catch (_) { /* ignore */ } return !o; });
  const [detail, setDetail] = useState({});   // video_id -> row with script | { error }

  const videos = useMemo(() => (data && data.videos) || [], [data]);
  const summary = (data && data.summary) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? videos.filter((v) => [v.caption, v.hook_summary, v.video_id, v.date_posted].some((f) => f && String(f).toLowerCase().includes(q)))
      : videos;
    const col = COLUMNS.find((c) => c.key === sort.key) || COLUMNS[0];
    return [...list].sort((a, b) => compare(a, b, sort.key, col.sort, sort.dir) || compare(a, b, 'video_id', 'text', 'desc'));
  }, [videos, query, sort]);

  useEffect(() => { setShown(PAGE); }, [query, sort]);

  useEffect(() => {
    if (!open || detail[open]) return;
    let live = true;
    getSocialVideo(open)
      .then((row) => { if (live) setDetail((d) => ({ ...d, [open]: row })); })
      .catch((e) => { if (live) setDetail((d) => ({ ...d, [open]: { error: e.message } })); });
    return () => { live = false; };
  }, [open, detail]);

  const clickSort = (c) => {
    if (!c.sort) return;
    setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.sort === 'num' ? 'desc' : 'desc' }));
  };
  const arrow = (c) => (sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  const actions = (
    <a href={SHEET_URL} target="_blank" rel="noreferrer" style={{ ...outlineButton(COLORS.ink), textDecoration: 'none', display: 'inline-block' }}>Drive</a>
  );

  if (error) return <SocialCard title="TikTok Data" collapsible open={cardOpen} onToggle={toggleCard} actions={actions}><div style={{ color: COLORS.danger, fontSize: 13 }}>Error: {error}</div></SocialCard>;
  if (loading && !data) return <SocialCard title="TikTok Data" collapsible open={cardOpen} onToggle={toggleCard} actions={actions}><div style={{ color: COLORS.muted, fontSize: 13 }}>Loading videos...</div></SocialCard>;
  if (data && data.available === false) {
    return (
      <SocialCard title="TikTok Data" collapsible open={cardOpen} onToggle={toggleCard} actions={actions}>
        <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 560 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>The TikTok tracker database is not on this server.</div>
          <div>The Planner reads <code>TikTokAnalyzer/data/tiktok.db</code> in place (or the path in <code>TIKTOK_DB_PATH</code>). The Google Sheet is written from that same file by the tracker's daily run.</div>
        </div>
      </SocialCard>
    );
  }

  const visible = filtered.slice(0, shown);
  const colCount = COLUMNS.length;
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search caption, hook, id, date..."
        style={{ border: `1px solid ${COLORS.hairline}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, width: 240, maxWidth: '100%', background: COLORS.paper, color: COLORS.ink }}
      />
      {actions}
    </div>
  );

  return (
    <SocialCard title="TikTok Data" collapsible open={cardOpen} onToggle={toggleCard} actions={header}>
      {summary ? (
        <div style={tileGrid(130)}>
          <SocialTile label="Videos" value={num(summary.videos)} />
          <SocialTile label="Total views" value={num(summary.total_views)} />
          <SocialTile label="Views, last 30 days" value={num(summary.views_30d)} />
          <SocialTile label="Posts, last 30 days" value={num(summary.posts_30d)} />
          <SocialTile label="Last post" value={shortDate(summary.last_post)} size={16} />
          <SocialTile label="Data updated" value={dateTime(summary.updated_at)} size={16} sub="tracker refresh" />
        </div>
      ) : null}

      <div style={{ ...tableWrap, marginTop: 18 }}>
        <table style={{ ...table, minWidth: 1180 }}>
          <thead>
            <tr style={headRow}>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => clickSort(c)} style={{ ...(c.sort === 'num' ? thNum : th), cursor: c.sort ? 'pointer' : 'default', userSelect: 'none' }} title={c.sort ? 'Sort' : undefined}>
                  {c.label}{arrow(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => {
              const isOpen = open === v.video_id;
              const d = detail[v.video_id];
              return (
                <React.Fragment key={v.video_id}>
                  <tr className="row-hover" onClick={() => setOpen(isOpen ? null : v.video_id)} style={{ cursor: 'pointer', background: isOpen ? COLORS.page : undefined }}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{shortDate(v.date_posted)}</td>
                    <td style={mutedCell}>{v.video_id}</td>
                    <td style={mutedCell}>{v.username || '-'}</td>
                    <td style={{ ...td, ...clamp(240) }} title={v.caption || ''}>{v.caption || <span style={{ color: COLORS.faint }}>-</span>}</td>
                    <td style={{ ...tdNum, fontWeight: 600 }}>{count(v.views)}</td>
                    <td style={tdNum}>{count(v.likes)}</td>
                    <td style={tdNum}>{count(v.comments)}</td>
                    <td style={tdNum}>{count(v.saves)}</td>
                    <td style={tdNum}>{count(v.shares)}</td>
                    <td style={{ ...td, ...clamp(260) }} title={v.hook_summary || ''}>{v.hook_summary || <span style={{ color: COLORS.faint }}>-</span>}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{v.url ? <a href={v.url} target="_blank" rel="noreferrer" style={tableLink} onClick={(e) => e.stopPropagation()}>Open</a> : '-'}</td>
                    <td style={tdNum} title={v.baseline_spans_gap ? 'The baseline window spans a posting gap of more than 60 days' : ''}>{multipleText(v.multiple, v.baseline_spans_gap)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: COLORS.accent, fontWeight: 600 }}>{isOpen ? 'Hide' : 'Show'}</td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={colCount} style={{ ...td, padding: '0 0 12px', borderBottom: `1px solid ${COLORS.hairline}` }}>
                        <div style={{ background: COLORS.page, borderRadius: 10, padding: '12px 16px', fontSize: 13, lineHeight: 1.6, display: 'grid', gap: 8 }}>
                          <div><span style={{ color: COLORS.muted, fontWeight: 600 }}>Caption: </span>{v.caption || <span style={{ color: COLORS.faint }}>none</span>}</div>
                          <div><span style={{ color: COLORS.muted, fontWeight: 600 }}>Hook: </span>{v.hook_summary || <span style={{ color: COLORS.faint }}>none</span>}</div>
                          <div>
                            <span style={{ color: COLORS.muted, fontWeight: 600 }}>Script: </span>
                            {!d ? <span style={{ color: COLORS.muted }}>Loading...</span>
                              : d.error ? <span style={{ color: COLORS.danger }}>{d.error}</span>
                              : d.script ? <span style={{ whiteSpace: 'pre-wrap' }}>{d.script}</span>
                              : <span style={{ color: COLORS.faint }}>no transcript</span>}
                          </div>
                          {d && d.script_summary ? <div><span style={{ color: COLORS.muted, fontWeight: 600 }}>Summary: </span>{d.script_summary}</div> : null}
                          <div style={{ fontSize: 11, color: COLORS.faint }}>
                            Source {v.source || '-'}, first seen {dateTime(v.first_seen_at)}, last refreshed {dateTime(v.last_refreshed_at)}{v.last_refresh_status ? ` (${v.last_refresh_status})` : ''}.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
            {!visible.length ? <tr><td colSpan={colCount} style={{ ...td, color: COLORS.muted }}>No videos match.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {filtered.length > shown ? (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setShown((n) => n + PAGE)} style={outlineButton(COLORS.ink)}>
            Show {Math.min(PAGE, filtered.length - shown)} more ({num(filtered.length - shown)} left)
          </button>
        </div>
      ) : null}
    </SocialCard>
  );
}
