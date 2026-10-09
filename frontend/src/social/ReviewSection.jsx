import React, { useCallback, useEffect, useRef, useState } from 'react';
import SocialCard from './SocialCard';
import { tableLink } from './SocialTable';
import { getReview, generateReview } from './api';
import { dateTime, multipleText } from './format';
import { Cover } from './CompetitorsSection';
import { COLORS, outlineButton } from '../shared/styles';

const POLL_MS = 3000;
// Header buttons on this tab share one minimum width so Refresh and the TikTok Data card's Drive match.
export const HEADER_BUTTON_MIN = 72;
const TIKTOK_URL = (id) => `https://www.tiktok.com/video/${id}`;

// "Video Recommendations" (layout 8 of https://claude.ai/artifact/JvcMs8PTectBkTGoWv4cuV, 2026-10-08):
// a tab strip with one tab, Hooks To Consider: the competitors' real winning opening lines, read live
// from the competitor research, each with its cover, move, account and multiple. Refresh re-runs the
// Claude review of your own videos; the server also runs it each morning when new videos arrive.
export default function ReviewSection() {
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

  return (
    <SocialCard title={title} actions={refreshButton}>
      {rev.running ? <div style={{ ...muted, marginBottom: 8 }}>Reviewing your recent videos...</div> : null}
      {noticeLine}
      {failed}
      {hookList}
    </SocialCard>
  );
}

// The tab strip (one tab today, room for more) and the hook rows: number, cover, the line in the
// competitor's own words linked to the video, then move, account and multiple in muted italics.
const tabStrip = { display: 'flex', gap: 4, borderBottom: `1px solid ${COLORS.hairline}`, margin: '10px 0 4px' };
const tabOn = { fontSize: 13, fontWeight: 600, color: COLORS.ink, padding: '8px 10px', borderBottom: `2px solid ${COLORS.accent}`, marginBottom: -1 };

function CompetitorHooks({ hooks }) {
  return (
    <>
      <div role="tablist" style={tabStrip}>
        <span role="tab" aria-selected="true" style={tabOn}>Hooks To Consider</span>
      </div>
      {!hooks.length ? <div style={{ color: COLORS.muted, fontSize: 13, padding: '8px 0' }}>No competitor hooks yet.</div> : (
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {hooks.map((h, i) => (
            <li key={h.video_id} style={{ display: 'grid', gridTemplateColumns: '28px 30px minmax(0, 1fr)', gap: 10, padding: '7px 0', borderTop: i ? `1px solid ${COLORS.hairline}` : 'none', alignItems: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: COLORS.calloutBg, color: COLORS.calloutText, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
              <Cover v={{ ...h, url: h.url || TIKTOK_URL(h.video_id) }} width={30} />
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>
                <a href={h.url || TIKTOK_URL(h.video_id)} target="_blank" rel="noreferrer" style={{ ...tableLink, fontWeight: 600, color: COLORS.ink }}>"{h.line}"</a>
                <em style={{ color: COLORS.muted, fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                  {[h.move, `@${h.handle}`, multipleText(h.multiple, false)].filter(Boolean).join(' \u00b7 ')}
                </em>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
