import React, { useCallback, useEffect, useRef, useState } from 'react';
import SocialCard from './SocialCard';
import { tableWrap, table, th, thNum, headRow, td, tdNum, tableLink, blockLabel } from './SocialTable';
import { getReview, generateReview } from './api';
import { monthDay, shortDate, dateTime, multipleText, count } from './format';
import { COLORS, outlineButton } from '../shared/styles';
import { num } from '../shared/format';

const POLL_MS = 3000;
const TIKTOK_URL = (id) => `https://www.tiktok.com/video/${id}`;

// "Next Video Hooks & Ideas": the latest Claude review of the recent videos. The top
// performers table is the backend's own numbers; the prose is the model's. Generating
// runs in the background on the server, so the card polls until the row lands.
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
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  // Poll while the server says a run is in progress.
  useEffect(() => {
    if (!rev || !rev.running) return undefined;
    timer.current = setTimeout(load, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [rev, load]);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    setNotice(null);
    try {
      const r = await generateReview();
      if (r.status === 202 || r.status === 409) { setRev((cur) => ({ ...(cur || { available: false }), running: true })); return; }
      if (r.status === 429) { setNotice(`${r.error}. Next run allowed ${dateTime(r.next_allowed_at)}.`); return; }
      setNotice(r.error || 'Could not start the review.');
    } catch (e) {
      setNotice(e.message);
    }
  };

  const urlFor = (id) => {
    const v = (videos || []).find((x) => x.video_id === id);
    return (v && v.url) || TIKTOK_URL(id);
  };
  const dateFor = (id) => {
    const v = (videos || []).find((x) => x.video_id === id);
    return v ? monthDay(v.date_posted) : id;
  };

  const running = Boolean(rev && rev.running);
  const throttled = rev && rev.throttle;
  const canStart = !running && !throttled && (!rev || rev.has_key !== false);
  const buttonTitle = running ? 'A review is being generated' : throttled ? `${throttled.reason}; next run ${dateTime(throttled.next_allowed_at)}` : 'Ask Claude for a fresh review of the recent videos';
  const button = (label) => (
    <button type="button" onClick={start} disabled={!canStart} title={buttonTitle} style={outlineButton(COLORS.accent, { disabled: !canStart })}>
      {running ? 'Reviewing...' : label}
    </button>
  );

  const stale = rev && rev.available && rev.stale && rev.stale.new_videos > 0
    ? <span style={{ fontSize: 12, color: COLORS.muted }}>{rev.stale.new_videos} new {rev.stale.new_videos === 1 ? 'video' : 'videos'} since this review</span>
    : null;

  const aside = rev && rev.available
    ? `${rev.window.count} videos, ${rev.window.basis}, generated ${dateTime(rev.generated_at)}`
    : null;

  const messages = (
    <>
      {notice ? <div style={{ fontSize: 13, color: COLORS.danger, marginTop: 8 }}>{notice}</div> : null}
      {rev && rev.last_error && (!rev.available || rev.last_error.at > rev.generated_at)
        ? <div style={{ fontSize: 13, color: COLORS.danger, marginTop: 8 }}>Last attempt failed{rev.last_error.at ? ` (${dateTime(rev.last_error.at)})` : ''}: {rev.last_error.message}</div>
        : null}
      {rev && rev.has_key === false ? <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 8 }}>The server has no Claude API key, so reviews cannot be generated.</div> : null}
    </>
  );

  if (error) {
    return <SocialCard title="Next Video Hooks & Ideas"><div style={{ color: COLORS.danger, fontSize: 13 }}>Error: {error}</div></SocialCard>;
  }
  if (!rev) {
    return <SocialCard title="Next Video Hooks & Ideas"><div style={{ color: COLORS.muted, fontSize: 13 }}>Loading...</div></SocialCard>;
  }
  if (!rev.available) {
    return (
      <SocialCard title="Next Video Hooks & Ideas" actions={button('Generate review')}>
        <div style={{ color: COLORS.muted, fontSize: 13 }}>
          {running ? 'Reviewing your recent videos with Claude. This takes a minute or two.' : 'No review yet. Generate one to see which recent videos worked, why, and what to post next.'}
        </div>
        {messages}
      </SocialCard>
    );
  }

  const { review, stats } = rev;
  const byId = new Map(stats.videos.map((v) => [v.video_id, v]));
  const notes = new Map((review.top_performers || []).map((t) => [t.video_id, t]));
  const top = (stats.top || []).map((id) => byId.get(id)).filter(Boolean);

  return (
    <SocialCard title="Next Video Hooks & Ideas" aside={aside} actions={<>{stale}{button('Regenerate')}</>}>
      {running ? <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 10 }}>Reviewing your recent videos with Claude. This takes a minute or two; the card refreshes on its own.</div> : null}
      {messages}
      <div style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.5, color: COLORS.muted }}>{review.window_summary}</div>

      <div style={blockLabel}>Top performers, {stats.basis} ({shortDate(stats.start)} to {shortDate(stats.end)})</div>
      <div style={tableWrap}>
        <table style={{ ...table, minWidth: 720 }}>
          <thead>
            <tr style={headRow}>
              <th style={th}>Posted</th><th style={{ ...th, width: '40%' }}>Opening line</th>
              <th style={thNum}>Views</th><th style={thNum}>Likes</th><th style={thNum}>Comments</th><th style={thNum}>Saves</th><th style={thNum}>Shares</th>
              <th style={thNum} title="Views relative to your own rolling baseline; 1.0x is a normal post">Multiple</th>
            </tr>
          </thead>
          <tbody>
            {top.map((v) => {
              const n = notes.get(v.video_id);
              return (
                <React.Fragment key={v.video_id}>
                  <tr>
                    <td style={{ ...td, whiteSpace: 'nowrap', borderBottom: 'none' }}>{shortDate(v.date_posted)}</td>
                    <td style={{ ...td, borderBottom: 'none' }}>
                      <a href={urlFor(v.video_id)} target="_blank" rel="noreferrer" style={{ ...tableLink, fontWeight: 500, color: COLORS.ink }}>{v.hook || v.caption || '(no opening line)'}</a>
                    </td>
                    <td style={{ ...tdNum, borderBottom: 'none', fontWeight: 600 }} title={`Per 1,000 views: ${num(v.likes_per_k, 1)} likes, ${num(v.comments_per_k, 1)} comments, ${num(v.saves_per_k, 1)} saves, ${num(v.shares_per_k, 1)} shares`}>{count(v.views)}</td>
                    <td style={{ ...tdNum, borderBottom: 'none' }}>{count(v.likes)}</td>
                    <td style={{ ...tdNum, borderBottom: 'none' }}>{count(v.comments)}</td>
                    <td style={{ ...tdNum, borderBottom: 'none' }}>{count(v.saves)}</td>
                    <td style={{ ...tdNum, borderBottom: 'none' }}>{count(v.shares)}</td>
                    <td style={{ ...tdNum, borderBottom: 'none' }}>{multipleText(v.multiple, false)}</td>
                  </tr>
                  <tr>
                    <td colSpan={8} style={{ ...td, padding: '0 0 8px', fontSize: 12, lineHeight: 1.45, color: COLORS.muted }}>
                      {n ? n.why_it_worked : null}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 32px' }}>
        <div>
          <div style={blockLabel}>What is working</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
            {(review.patterns_working || []).map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
          </ul>
        </div>
        <div>
          <div style={blockLabel}>What is not</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: COLORS.muted }}>
            {(review.patterns_not_working || []).map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
          </ul>
        </div>
      </div>

      <div style={blockLabel}>Next video hooks and ideas</div>
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {(review.recommendations || []).map((r, i) => (
          <li key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, padding: '7px 0', borderTop: i ? `1px solid ${COLORS.hairline}` : 'none' }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: COLORS.calloutBg, color: COLORS.calloutText, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>"{r.hook}"</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: COLORS.muted, marginTop: 2 }}>
                {r.idea}
                {r.evidence_video_ids && r.evidence_video_ids.length ? (
                  <>
                    {' \u00b7 '}
                    {r.evidence_video_ids.map((id, j) => (
                      <React.Fragment key={id}>{j ? ', ' : ''}<a href={urlFor(id)} target="_blank" rel="noreferrer" style={tableLink}>{dateFor(id)}</a></React.Fragment>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div style={{ fontSize: 11, color: COLORS.faint, marginTop: 14 }}>
        {rev.model}{rev.usage && rev.usage.input_tokens ? `, ${num(rev.usage.input_tokens)} tokens in / ${num(rev.usage.output_tokens)} out` : ''}{rev.usage && rev.usage.duration_ms ? `, ${Math.round(rev.usage.duration_ms / 1000)} s` : ''}
      </div>
    </SocialCard>
  );
}
