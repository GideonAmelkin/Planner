import React, { useEffect, useMemo, useState } from 'react';
import { tableWrap, table, th, thNum, headRow, td, tdNum, tableLink } from './SocialTable';
import { getSocialVideo } from './api';
import { shortDate, multipleText, count } from './format';
import { COLORS } from '../shared/styles';
import { num } from '../shared/format';
import { API_BASE } from '../shared/api';
import { todayISO, shiftISO } from '../shared/dayInfo';

// Video Recommendations' Top Videos tab: your 10 most viewed videos posted in the last 30 days (the same
// window as the TikTok Data tile and chart), from the live tracker rows. Click a header to re-sort those
// ten, a row to read its caption and transcript. Each opening line carries its move from the latest review.
const WINDOW_DAYS = 30;
const TOP_N = 10;
const COLS = [
  { key: 'date_posted', label: 'Posted', kind: 'text' },
  { key: 'views', label: 'Views', kind: 'num' },
  { key: 'likes', label: 'Likes', kind: 'num' },
  { key: 'comments', label: 'Comments', kind: 'num' },
  { key: 'saves', label: 'Saves', kind: 'num' },
  { key: 'shares', label: 'Shares', kind: 'num' },
  { key: 'multiple', label: 'Multiple', kind: 'num', title: 'Views relative to your own rolling baseline; 1.0x is a normal post' },
];
const perK = (n, views) => (views ? (Number(n) || 0) / views * 1000 : null);

// Your video's cover from the server's cache; a neutral tile until the job has fetched it.
function OwnCover({ v }) {
  const [failed, setFailed] = useState(false);
  const box = { display: 'block', width: 30, aspectRatio: '9 / 16', borderRadius: 5, overflow: 'hidden', background: COLORS.hairline };
  return (
    <a href={v.url} target="_blank" rel="noreferrer" style={box} title="Open on TikTok" onClick={(e) => e.stopPropagation()}>
      {failed ? null : <img src={`${API_BASE}/social/thumb/${v.video_id}`} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </a>
  );
}

export default function TopVideos({ videos, moves }) {
  const [sort, setSort] = useState({ key: 'views', dir: 'desc' });
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState({});   // video_id -> row with script | { error }

  const start = shiftISO(todayISO(), -WINDOW_DAYS);
  const rows = useMemo(() => {
    const list = (videos || []).filter((v) => v.date_posted && v.date_posted >= start)
      .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, TOP_N);
    const col = COLS.find((c) => c.key === sort.key);
    const val = (v) => (col.kind === 'num' ? Number(v[sort.key]) || 0 : String(v[sort.key] || ''));
    return [...list].sort((a, b) => {
      const x = val(a); const y = val(b);
      const r = col.kind === 'num' ? x - y : x.localeCompare(y);
      return (sort.dir === 'asc' ? r : -r) || (Number(b.views) || 0) - (Number(a.views) || 0);
    });
  }, [videos, start, sort]);

  useEffect(() => {
    if (!open || detail[open]) return undefined;
    let live = true;
    getSocialVideo(open)
      .then((row) => { if (live) setDetail((d) => ({ ...d, [open]: row })); })
      .catch((e) => { if (live) setDetail((d) => ({ ...d, [open]: { error: e.message } })); });
    return () => { live = false; };
  }, [open, detail]);

  if (!rows.length) return <div style={{ color: COLORS.muted, fontSize: 13, padding: '8px 0' }}>No posts in the last 30 days.</div>;

  const clickSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  const head = (c, style) => (
    <th key={c.key} style={{ ...style, cursor: 'pointer', userSelect: 'none' }} title={c.title || 'Sort'} onClick={() => clickSort(c.key)}>
      {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const muted = { color: COLORS.muted, fontWeight: 400 };

  return (
    <>
      <div style={{ ...tableWrap, marginTop: 6 }}>
        <table style={{ ...table, minWidth: 780 }}>
          <thead>
            <tr style={headRow}>
              <th style={{ ...th, width: 28 }}>#</th>
              <th style={{ ...th, width: 40 }} aria-label="Cover" />
              {head(COLS[0], th)}
              <th style={{ ...th, width: '40%' }}>Opening line</th>
              {COLS.slice(1).map((c) => head(c, thNum))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => {
              const views = Number(v.views) || 0;
              const isOpen = open === v.video_id;
              const d = detail[v.video_id];
              const move = moves.get(v.video_id);
              return (
                <React.Fragment key={v.video_id}>
                  <tr onClick={() => setOpen(isOpen ? null : v.video_id)} style={{ cursor: 'pointer', background: isOpen ? COLORS.calloutBg : undefined }}>
                    <td style={{ ...td, color: COLORS.muted, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{i + 1}</td>
                    <td style={{ ...td, verticalAlign: 'middle' }}><OwnCover v={v} /></td>
                    <td style={{ ...td, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{shortDate(v.date_posted)}</td>
                    <td style={{ ...td, verticalAlign: 'middle' }}>
                      <span style={{ fontWeight: 500 }}>{v.hook_summary || v.caption || '(no opening line)'}</span>
                      {move ? <span style={muted}> ({move})</span> : null}
                    </td>
                    <td style={{ ...tdNum, fontWeight: 600, verticalAlign: 'middle' }} title={`Per 1,000 views: ${num(perK(v.likes, views), 1)} likes, ${num(perK(v.comments, views), 1)} comments, ${num(perK(v.saves, views), 1)} saves, ${num(perK(v.shares, views), 1)} shares`}>{count(v.views)}</td>
                    <td style={{ ...tdNum, verticalAlign: 'middle' }}>{count(v.likes)}</td>
                    <td style={{ ...tdNum, verticalAlign: 'middle' }}>{count(v.comments)}</td>
                    <td style={{ ...tdNum, verticalAlign: 'middle' }}>{count(v.saves)}</td>
                    <td style={{ ...tdNum, verticalAlign: 'middle' }}>{count(v.shares)}</td>
                    <td style={{ ...tdNum, verticalAlign: 'middle' }}>{multipleText(v.multiple, false)}</td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td style={td} />
                      <td colSpan={9} style={{ ...td, fontSize: 13, lineHeight: 1.55 }}>
                        <div style={{ maxWidth: 760 }}>
                          {v.caption ? <div style={{ marginBottom: 8 }}><span style={{ ...muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Caption</span><div>{v.caption}</div></div> : null}
                          <span style={{ ...muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Transcript</span>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{!d ? 'Loading...' : d.error ? `Could not load the transcript: ${d.error}` : (d.script || '(no transcript)')}</div>
                          {v.url ? <a href={v.url} target="_blank" rel="noreferrer" style={{ ...tableLink, display: 'inline-block', marginTop: 8 }}>Open on TikTok</a> : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
