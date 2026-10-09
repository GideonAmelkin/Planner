import React, { useCallback, useEffect, useRef, useState } from 'react';
import SocialCard from './SocialCard';
import { tableWrap, table, th, thNum, headRow, td, tdNum, tableLink, blockLabel } from './SocialTable';
import { getReview, generateReview } from './api';
import { shortDate, dateTime, multipleText, count } from './format';
import { COLORS, outlineButton } from '../shared/styles';
import { num } from '../shared/format';

const POLL_MS = 3000;
// Header buttons on this tab share one minimum width so Refresh and the TikTok Data card's Drive match.
export const HEADER_BUTTON_MIN = 72;
const TIKTOK_URL = (id) => `https://www.tiktok.com/video/${id}`;

// "Summary": the latest Claude review of the recent videos: Top performers (the backend's own numbers, each opening line tagged
// with its hook type) and Hooks to consider (the competitors' real winning opening lines, read live from the
// competitor research, each with its move, account and multiple). The server generates a review each
// morning when new videos arrive; the card only reads.
export default function ReviewSection({ videos }) {
  const [rev, setRev] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
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

  // Ask the server for a fresh review; the poll above picks up the result.
  const refresh = async () => {
    setNotice(null);
    try {
      const r = await generateReview();
      if (r.status === 202 || r.status === 409) { setRev((cur) => ({ ...(cur || { available: false }), running: true })); return; }
      if (r.status === 429) { await load(); return; }   // the cap was hit; the button greys out
      setNotice(r.error || 'Could not start the review.');
    } catch (e) {
      setNotice(e.message);
    }
  };

  const title = 'Video Recommendations';
  const muted = { color: COLORS.muted, fontSize: 13 };
  const running = Boolean(rev && rev.running);
  const capped = Boolean(rev && rev.throttle);   // the day's refreshes are used up
  const buttonTitle = running ? 'A new set is being written' : capped ? `${rev.throttle.cap} refreshes used today; more tomorrow` : 'Re-read your recent videos';
  const refreshButton = (
    <button type="button" onClick={refresh} disabled={running || capped} title={buttonTitle} style={{ ...outlineButton(COLORS.accent, { disabled: running || capped }), minWidth: HEADER_BUTTON_MIN }}>
      {running ? 'Refreshing...' : 'Refresh'}
    </button>
  );
  const hookList = <CompetitorHooks hooks={(rev && rev.competitor_hooks) || []} />;
  const noticeLine = notice ? <div style={{ ...muted, marginTop: 8 }}>{notice}</div> : null;

  if (error) return <SocialCard title={title}><div style={{ color: COLORS.danger, fontSize: 13 }}>Error: {error}</div></SocialCard>;
  if (!rev) return <SocialCard title={title}><div style={muted}>Loading...</div></SocialCard>;

  const failed = rev.last_error && (!rev.available || rev.last_error.at > rev.generated_at)
    ? <div style={{ fontSize: 13, color: COLORS.danger, marginTop: 8 }}>Last attempt failed{rev.last_error.at ? ` (${dateTime(rev.last_error.at)})` : ''}: {rev.last_error.message}</div>
    : null;

  if (!rev.available) {
    return (
      <SocialCard title={title} actions={refreshButton}>
        <div style={muted}>{rev.running ? 'Reviewing your recent videos...' : 'No review yet. One is generated each morning from the tracker\'s new videos.'}</div>
        {noticeLine}
        {failed}
        {hookList}
      </SocialCard>
    );
  }

  const { review, stats } = rev;
  const byId = new Map(stats.videos.map((v) => [v.video_id, v]));
  const typeOf = new Map((review.hook_types || []).map((t) => [t.video_id, t.type]));
  const top = (stats.top || []).map((id) => byId.get(id)).filter(Boolean);
  const typeTag = (type) => (type ? <span style={{ color: COLORS.muted, fontWeight: 400 }}> ({type})</span> : null);

  return (
    <SocialCard title={title} actions={refreshButton}>
      {rev.running ? <div style={{ ...muted, marginBottom: 8 }}>Reviewing your recent videos...</div> : null}
      {noticeLine}
      {failed}

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

      {hookList}
    </SocialCard>
  );
}

// Hooks to consider: competitors' outlier opening lines in their own words, linked to the video,
// then the move, account and multiple in muted italics.
function CompetitorHooks({ hooks }) {
  if (!hooks.length) return null;
  return (
    <>
      <div style={blockLabel}>Hooks To Consider</div>
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {hooks.map((h, i) => (
          <li key={h.video_id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, padding: '6px 0', borderTop: i ? `1px solid ${COLORS.hairline}` : 'none', alignItems: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: COLORS.calloutBg, color: COLORS.calloutText, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>
              <a href={h.url || TIKTOK_URL(h.video_id)} target="_blank" rel="noreferrer" style={{ ...tableLink, fontWeight: 600, color: COLORS.ink }}>"{h.line}"</a>
              <em style={{ color: COLORS.muted, fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                {[h.move, `@${h.handle}`, multipleText(h.multiple, false)].filter(Boolean).join(' \u00b7 ')}
              </em>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
