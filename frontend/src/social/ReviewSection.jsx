import React, { useCallback, useEffect, useRef, useState } from 'react';
import SocialCard from './SocialCard';
import { tableWrap, table, th, thNum, headRow, td, tdNum, tableLink, blockLabel } from './SocialTable';
import { getReview } from './api';
import { shortDate, dateTime, multipleText, count } from './format';
import { COLORS, pill } from '../shared/styles';
import { num } from '../shared/format';

const POLL_MS = 3000;
const TIKTOK_URL = (id) => `https://www.tiktok.com/video/${id}`;

// "Summary": the latest Claude review of the recent videos, in three
// blocks: Summary, Top performers (the backend's own numbers, each opening line tagged
// with its hook type) and Hooks to consider (opening lines tagged with their type). The
// server generates a review each morning when new videos arrive; the card only reads.
export default function ReviewSection({ videos }) {
  const [rev, setRev] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await getReview();
      setRev(r);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Poll while the server says a run is in progress.
  useEffect(() => {
    if (!rev || !rev.running) return undefined;
    timer.current = setTimeout(load, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [rev, load]);

  useEffect(() => { load(); }, [load]);

  const urlFor = (id) => {
    const v = (videos || []).find((x) => x.video_id === id);
    return (v && v.url) || TIKTOK_URL(id);
  };

  const title = 'Summary';
  const muted = { color: COLORS.muted, fontSize: 13 };

  if (error) return <SocialCard title={title}><div style={{ color: COLORS.danger, fontSize: 13 }}>Error: {error}</div></SocialCard>;
  if (!rev) return <SocialCard title={title}><div style={muted}>Loading...</div></SocialCard>;

  const failed = rev.last_error && (!rev.available || rev.last_error.at > rev.generated_at)
    ? <div style={{ fontSize: 13, color: COLORS.danger, marginTop: 8 }}>Last attempt failed{rev.last_error.at ? ` (${dateTime(rev.last_error.at)})` : ''}: {rev.last_error.message}</div>
    : null;

  if (!rev.available) {
    return (
      <SocialCard title={title}>
        <div style={muted}>{rev.running ? 'Reviewing your recent videos...' : 'No review yet. One is generated each morning from the tracker\'s new videos.'}</div>
        {failed}
      </SocialCard>
    );
  }

  const { review, stats } = rev;
  const byId = new Map(stats.videos.map((v) => [v.video_id, v]));
  const typeOf = new Map((review.hook_types || []).map((t) => [t.video_id, t.type]));
  const top = (stats.top || []).map((id) => byId.get(id)).filter(Boolean);
  // Reviews made before the typed-hooks prompt carry `recommendations`; show their hook lines untyped.
  const hooks = review.hooks || (review.recommendations || []).map((r) => ({ hook: r.hook, type: null }));
  const pick = review.pick && Number.isInteger(review.pick.index) ? review.pick : null;
  const typeTag = (type) => (type ? <span style={{ color: COLORS.muted, fontWeight: 400 }}> ({type})</span> : null);

  return (
    <SocialCard title={title}>
      {rev.running ? <div style={{ ...muted, marginBottom: 8 }}>Reviewing your recent videos...</div> : null}
      {failed}

      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{review.window_summary}</div>

      <div style={blockLabel}>Top performers</div>
      <div style={tableWrap}>
        <table style={{ ...table, minWidth: 720 }}>
          <thead>
            <tr style={headRow}>
              <th style={th}>Posted</th><th style={{ ...th, width: '44%' }}>Opening line</th>
              <th style={thNum}>Views</th><th style={thNum}>Likes</th><th style={thNum}>Comments</th><th style={thNum}>Saves</th><th style={thNum}>Shares</th>
              <th style={thNum} title="Views relative to your own rolling baseline; 1.0x is a normal post">Multiple</th>
            </tr>
          </thead>
          <tbody>
            {top.map((v) => (
              <tr key={v.video_id}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{shortDate(v.date_posted)}</td>
                <td style={td}>
                  <a href={urlFor(v.video_id)} target="_blank" rel="noreferrer" style={{ ...tableLink, fontWeight: 500, color: COLORS.ink }}>{v.hook || v.caption || '(no opening line)'}</a>
                  {typeTag(typeOf.get(v.video_id))}
                </td>
                <td style={{ ...tdNum, fontWeight: 600 }} title={`Per 1,000 views: ${num(v.likes_per_k, 1)} likes, ${num(v.comments_per_k, 1)} comments, ${num(v.saves_per_k, 1)} saves, ${num(v.shares_per_k, 1)} shares`}>{count(v.views)}</td>
                <td style={tdNum}>{count(v.likes)}</td>
                <td style={tdNum}>{count(v.comments)}</td>
                <td style={tdNum}>{count(v.saves)}</td>
                <td style={tdNum}>{count(v.shares)}</td>
                <td style={tdNum}>{multipleText(v.multiple, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hooks.length ? (
        <>
          <div style={blockLabel}>Hooks to consider</div>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {hooks.map((h, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, padding: '6px 0', borderTop: i ? `1px solid ${COLORS.hairline}` : 'none', alignItems: 'center' }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: COLORS.calloutBg, color: COLORS.calloutText, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, minWidth: 0 }}>
                  "{h.hook}"{typeTag(h.type)}
                  {pick && pick.index === i ? (
                    <>
                      <span style={{ ...pill, background: COLORS.calloutBg, color: COLORS.calloutText, marginLeft: 8, padding: '2px 8px', fontSize: 11 }}>Pick</span>
                      {pick.caption ? <span style={{ color: COLORS.muted, fontWeight: 400, fontSize: 12, marginLeft: 8 }}>caption: {pick.caption}</span> : null}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </SocialCard>
  );
}
