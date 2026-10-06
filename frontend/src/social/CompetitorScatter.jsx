import React, { useEffect, useMemo, useState } from 'react';
import SocialCard from './SocialCard';
import { getCompetitors } from './api';
import { leaderboardRows, TYPE_LABEL } from './competitorRows';
import { compact, perK, secs, Pill, Cover, TYPE_STYLE, OpeningLine } from './CompetitorsSection';
import { monthDay } from './format';
import { COLORS } from '../shared/styles';
import { API_BASE } from '../shared/api';
import { num } from '../shared/format';

const PICK_KEY = 'planner.social.scatterPick';
const NARROW = '(max-width: 760px)';

function readKey(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } }
function writeKey(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* ignore */ } }

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

const median = (a) => {
  const s = a.filter((x) => x !== null && x !== undefined).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// The y value: the multiple, or the early multiple for a rising video still under the age gate.
const mult = (v) => v.multiple ?? v.early_multiple ?? null;
const multText = (m) => (m === null ? '-' : `${m >= 100 ? num(Math.round(m)) : num(m, 1)}x`);

// The Scatter section: every Leaderboard video as its cover, placed by its views (right) and its
// saves (up), both raw counts on log scales, so the most viewed and most saved videos meet in the top
// right. Clicking a cover shows it in the panel, which keeps the multiple and saves per 1k.
export default function CompetitorScatter() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pick, setPick] = useState(() => readKey(PICK_KEY, 'all'));
  const [selected, setSelected] = useState(null);
  const narrow = useNarrow();

  useEffect(() => {
    let live = true;
    getCompetitors().then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);

  const accounts = useMemo(() => (data && data.accounts) || [], [data]);
  const scope = pick === 'all' || accounts.some((a) => a.handle === pick) ? pick : 'all';
  const points = useMemo(() => leaderboardRows(accounts, scope).filter((v) => v.views),
    [accounts, scope]);

  if (error) return <SocialCard title="Scatter"><div style={{ color: COLORS.danger, fontSize: 13 }}>Error: {error}</div></SocialCard>;
  if (!data) return <SocialCard title="Scatter"><div style={{ color: COLORS.muted, fontSize: 13 }}>Loading...</div></SocialCard>;

  const choose = (v) => { setPick(v); writeKey(PICK_KEY, v); setSelected(null); };
  // x: views, y: saves, both raw counts on log scales (saves rise with views, so the most viewed and
  // most saved videos meet in the top right). Each axis spans whole powers of ten around the data.
  const lg = (n) => Math.log10(Math.max(1, Number(n) || 0));
  const xs = points.map((v) => lg(v.views));
  const ys = points.map((v) => lg(v.saves));
  const span = (vals) => [Math.floor(Math.min(...vals)), Math.max(Math.floor(Math.min(...vals)) + 1, Math.ceil(Math.max(...vals)))];
  const [xLo, xHi] = span(xs);
  const [yLo, yHi] = span(ys);
  const X = (x) => ((Math.min(Math.max(x, xLo), xHi) - xLo) / (xHi - xLo)) * 100;
  const Y = (y) => ((Math.min(Math.max(y, yLo), yHi) - yLo) / (yHi - yLo)) * 100;
  const xMed = median(xs);
  const yMed = median(ys);
  const powers = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const xTicks = powers(xLo, xHi);
  const yTicks = powers(yLo, yHi);
  const on = points.find((v) => v.video_id === selected) || [...points].sort((a, b) => mult(b) - mult(a))[0];
  const height = narrow ? 380 : 520;
  const axis = { position: 'absolute', fontSize: 11, color: COLORS.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const quad = { position: 'absolute', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.faint };

  return (
    <SocialCard title="Scatter">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <Pill active={scope === 'all'} onClick={() => choose('all')}>All</Pill>
        {accounts.map((a) => (
          <Pill key={a.handle} active={scope === a.handle} onClick={() => choose(a.handle)}>@{a.handle}</Pill>
        ))}
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
        Right: more views. Up: more saves. Click a cover to read it.
      </div>
      {!points.length ? <div style={{ color: COLORS.muted, fontSize: 13 }}>Nothing to plot yet.</div> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 340px', padding: '28px 18px 40px 46px', minWidth: 0, boxSizing: 'border-box' }}>
            <div role="img" aria-label="Competitor videos by multiple and saves per thousand views"
              style={{ position: 'relative', height, borderLeft: `1px solid ${COLORS.hairline}`, borderBottom: `1px solid ${COLORS.hairline}` }}>
              {xTicks.map((t) => (
                <React.Fragment key={t}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${X(t)}%`, width: 1, background: COLORS.hairline }} />
                  <span style={{ ...axis, bottom: -22, left: `${X(t)}%`, transform: 'translateX(-50%)' }}>{compact(10 ** t)}</span>
                </React.Fragment>
              ))}
              {yTicks.map((t) => (
                <React.Fragment key={t}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${Y(t)}%`, height: 1, background: COLORS.hairline }} />
                  <span style={{ ...axis, left: -44, width: 38, textAlign: 'right', bottom: `calc(${Y(t)}% - 7px)` }}>{compact(10 ** t)}</span>
                </React.Fragment>
              ))}
              <span style={{ ...axis, right: 0, bottom: -36, whiteSpace: 'normal', textAlign: 'right' }}>views</span>
              <span style={{ ...axis, left: -44, top: -24 }}>saves</span>
              {xMed !== null ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${X(xMed)}%`, borderLeft: `1px dashed ${COLORS.faint}` }} /> : null}
              {yMed !== null ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${Y(yMed)}%`, borderTop: `1px dashed ${COLORS.faint}` }} /> : null}
              <span style={{ ...quad, left: 8, top: 6 }}>Saved, fewer views</span>
              <span style={{ ...quad, right: 6, top: 6 }}>Most viewed and saved</span>
              <span style={{ ...quad, right: 6, bottom: 6 }}>Viewed, rarely saved</span>
              {points.map((v) => {
                const active = on && on.video_id === v.video_id;
                return (
                  <button key={v.video_id} type="button" onClick={() => setSelected(v.video_id)} aria-label={v.hook || v.caption || 'video'}
                    style={{
                      position: 'absolute', left: `${X(lg(v.views))}%`, bottom: `${Y(lg(v.saves))}%`,
                      transform: 'translate(-50%, 50%)', width: active ? 40 : 30, padding: 0, cursor: 'pointer', zIndex: active ? 5 : 1,
                      border: `2px solid ${active ? COLORS.accent : COLORS.paper}`, borderRadius: 6, background: COLORS.hairline,
                      boxShadow: '0 1px 4px rgba(0,0,0,.25)', overflow: 'hidden', lineHeight: 0,
                    }}>
                    {v.has_thumb
                      ? <img src={`${API_BASE}/social/thumb/${v.video_id}`} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', display: 'block' }} />
                      : <span style={{ display: 'block', width: '100%', aspectRatio: '9 / 16' }} />}
                  </button>
                );
              })}
            </div>
          </div>
          {on ? (
            <div style={{ flex: '1 1 220px', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, fontSize: 13 }}>
              <Cover v={on} width={120} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: COLORS.accent, fontWeight: 600 }}>@{on.handle}</span>
                <span style={{ ...TYPE_STYLE[on.type], fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', padding: '1px 6px', borderRadius: 5 }}>{TYPE_LABEL[on.type]}</span>
                <span style={{ color: COLORS.muted }}>{monthDay(on.date_posted)}</span>
              </div>
              <OpeningLine key={on.video_id} v={on} style={{ fontSize: 14 }} />
              {on.move ? <em style={{ color: COLORS.muted }}>{on.move}</em> : null}
              <span style={{ fontSize: 12, color: COLORS.muted }}>{[on.format, on.text_overlay ? 'text overlay' : null, secs(on.duration)].filter(Boolean).join(', ')}</span>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: COLORS.muted }}>
                <span>multiple <b style={{ color: COLORS.ink }}>{multText(mult(on))}{on.multiple === null || on.multiple === undefined ? ' early' : ''}</b></span>
                <span>saves/1k <b style={{ color: COLORS.ink }}>{perK(on.saves_per_k)}</b></span>
                <span>views <b style={{ color: COLORS.ink }}>{compact(on.views)}</b></span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SocialCard>
  );
}
