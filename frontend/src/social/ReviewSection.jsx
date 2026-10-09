import React, { useCallback, useEffect, useRef, useState } from 'react';
import SocialCard from './SocialCard';
import { getReview, generateReview } from './api';
import { dateTime, multipleText } from './format';
import { Cover } from './CompetitorsSection';
import TopVideos from './TopVideos';
import { COLORS, outlineButton } from '../shared/styles';

const POLL_MS = 3000;
// Header buttons on this tab share one minimum width so Refresh and the TikTok Data card's Drive match.
export const HEADER_BUTTON_MIN = 72;
const TIKTOK_URL = (id) => `https://www.tiktok.com/video/${id}`;

// "Video Recommendations" (layout 8 of https://claude.ai/artifact/JvcMs8PTectBkTGoWv4cuV, 2026-10-08):
// two tabs. Hooks To Consider: hook suggestions in your voice the Claude review writes, one per reference
// (a competitor outlier whose topic and move it borrows), each with the reference's cover as the link. Top Videos: your own last 30 days (TopVideos.jsx),
// each opening line tagged with the move the Claude review named. Refresh re-runs that review; the server
// also runs it each morning when new videos arrive. The open tab is remembered per browser.
const TAB_KEY = 'planner.social.recTab';
const TABS = [{ key: 'hooks', label: 'Hooks To Consider' }, { key: 'top', label: 'Top Videos' }];

export default function ReviewSection({ videos }) {
  const [rev, setRev] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState(() => { try { return localStorage.getItem(TAB_KEY) === 'top' ? 'top' : 'hooks'; } catch (_) { return 'hooks'; } });
  const pickTab = (key) => { setTab(key); try { localStorage.setItem(TAB_KEY, key); } catch (_) { /* ignore */ } };
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
  const moves = new Map(((rev && rev.review && rev.review.hook_types) || []).map((t) => [t.video_id, t.type]));
  const tabStrip = (
    <div role="tablist" style={tabRow}>
      {TABS.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => pickTab(t.key)} style={tabStyle(tab === t.key)}>{t.label}</button>
      ))}
    </div>
  );
  const hookList = (
    <>
      {tabStrip}
      {tab === 'top' ? <TopVideos videos={videos} moves={moves} /> : <HookSuggestions rev={rev} />}
    </>
  );
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

// The tab strip, and the hook rows: number, the reference video's cover (opens it), your suggested hook,
// then its move and the reference's account and multiple in muted italics.
const tabRow = { display: 'flex', gap: 4, borderBottom: `1px solid ${COLORS.hairline}`, margin: '10px 0 4px', flexWrap: 'wrap' };
const tabStyle = (on) => ({
  font: 'inherit', fontSize: 13, fontWeight: 600, color: on ? COLORS.ink : COLORS.muted, background: 'none', border: 'none',
  borderBottom: `2px solid ${on ? COLORS.accent : 'transparent'}`, padding: '8px 10px', marginBottom: -1, cursor: 'pointer',
});

// The latest review's hooks joined to the references stored with it. Reviews before prompt v9 have none.
function HookSuggestions({ rev }) {
  const refs = new Map((((rev && rev.stats) || {}).references || []).map((r) => [r.video_id, r]));
  const rows = (((rev && rev.review) || {}).hooks || []).map((h) => ({ ...h, ref: refs.get(h.ref_video_id) })).filter((h) => h.ref);
  if (!rows.length) {
    return <div style={{ color: COLORS.muted, fontSize: 13, padding: '8px 0' }}>{rev && rev.running ? 'Writing hook suggestions...' : 'No hook suggestions yet. Refresh to write them from the competitors\' winning videos.'}</div>;
  }
  return (
    <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
      {rows.map((h, i) => {
        const url = h.ref.url || TIKTOK_URL(h.ref.video_id);
        return (
          <li key={h.ref.video_id} style={{ display: 'grid', gridTemplateColumns: '28px 30px minmax(0, 1fr)', gap: 10, padding: '7px 0', borderTop: i ? `1px solid ${COLORS.hairline}` : 'none', alignItems: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: COLORS.calloutBg, color: COLORS.calloutText, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
            <span title={`Reference: @${h.ref.handle}, ${multipleText(h.ref.multiple, false)}${h.ref.line ? `: "${h.ref.line}"` : ''}`}>
              <Cover v={{ ...h.ref, url }} width={30} />
            </span>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere' }}>
              "{h.hook}"
              <em style={{ color: COLORS.muted, fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                {[h.move, `from @${h.ref.handle}`, multipleText(h.ref.multiple, false)].filter(Boolean).join(' \u00b7 ')}
              </em>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
