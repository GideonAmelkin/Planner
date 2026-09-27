import React from 'react';
import Glyph from '../shared/Glyph';
import { RingGauge, ArcGauge, Sparkline, LetterStrip, SplitBar, CHART } from '../shared/charts';
import { COLORS, card } from '../shared/styles';
import { timeOfDay } from './format';

// The At a Glance card: one shell, four shapes, one empty state. Every card keeps its
// full height and its slot in the grid whether or not it has a value.
const MIN_H = 300;
const big = { fontSize: 34, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1, color: COLORS.ink, fontVariantNumeric: 'tabular-nums' };
const mutedSm = { fontSize: 12, color: COLORS.muted };
const divider = { borderTop: `1px solid ${COLORS.hairline}`, margin: '14px 0 12px' };

// `guide` is the visible grey line (how to read the card); `tooltip` is the provenance,
// shown on hover.
export function CardShell({ label, glyph, color, guide, tooltip, children, style }) {
  return (
    <section style={{ ...card, minHeight: MIN_H, display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Glyph name={glyph} color={color} size={18} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {guide ? <div title={tooltip || undefined} style={{ fontSize: 12, color: COLORS.muted, marginTop: 12, lineHeight: 1.4, cursor: tooltip ? 'help' : 'default' }}>{guide}</div> : null}
    </section>
  );
}

export function EmptyCard({ label, glyph, color, reason, guide, tooltip }) {
  return (
    <CardShell label={label} glyph={glyph} color={color} guide={guide} tooltip={tooltip}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px 6px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: COLORS.page, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Glyph name={glyph} color={COLORS.faint} size={24} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <div style={{ ...mutedSm, maxWidth: 220, lineHeight: 1.45 }}>{reason}</div>
      </div>
    </CardShell>
  );
}

function RingCard({ spec, p }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6 }}>
        <RingGauge value={p.ring.value} goal={p.ring.goal} color={p.ring.color} segments={p.ring.segments || null} size={124} stroke={11}>
          <span style={{ ...big, fontSize: 30 }}>{p.center ?? '--'}</span>
        </RingGauge>
        {p.goal ? <div style={{ fontSize: 16, color: COLORS.ink, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>{p.goal}</div> : null}
      </div>
      <div style={{ flex: 1 }} />
      {spec.footer === 'letters' ? (
        <>
          <div style={divider} />
          <LetterStrip days={p.letters} />
          <div style={{ ...mutedSm, marginTop: 6 }}>Last 7d</div>
        </>
      ) : spec.footer === 'spark' ? (
        <>
          <div style={divider} />
          {p.spark && p.spark.length > 1 ? <Sparkline points={p.spark} color={CHART.muted} dot height={40} domain={[0, 6]} stroke={2.5} baseline={false} /> : <div style={{ ...mutedSm, height: 40 }}>Fewer than two days stored.</div>}
          <LetterStrip days={p.letters} style={{ marginTop: 6 }} />
          <div style={{ ...mutedSm, marginTop: 6 }}>Last 7d{p.note ? ` · ${p.note}` : ''}</div>
        </>
      ) : spec.footer === 'series' ? (
        <>
          <div style={{ marginTop: 14 }}>
            {p.series && p.series.points.length ? <Sparkline points={p.series.points} domain={p.series.domain} color={CHART.blue} bars min={0} max={100} height={48} baseline={false} /> : <div style={{ ...mutedSm, height: 48 }}>No intraday readings.</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...mutedSm, marginTop: 4 }}>
            <span>{p.series && p.series.domain ? timeOfDay(p.series.domain[0]) : '12 AM'}</span>
            <span>{p.series && p.series.domain ? timeOfDay(p.series.domain[1]) : '12 AM'}</span>
          </div>
        </>
      ) : null}
    </>
  );
}

function GaugeCard({ p }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6 }}>
        <ArcGauge value={p.gauge.value} min={p.gauge.min} max={p.gauge.max} zones={p.gauge.zones} size={150} stroke={10}>
          <span style={{ ...big, fontSize: 30 }}>{p.center}</span>
          {p.centerSub ? <span style={mutedSm}>{p.centerSub}</span> : null}
        </ArcGauge>
        {p.below ? <div style={{ fontSize: 18, fontWeight: 600, marginTop: -6 }}>{p.below}</div> : null}
      </div>
      <div style={{ flex: 1 }} />
      {p.bottom ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...big, fontSize: 28 }}>{p.bottom.big}</div>
          <div style={{ ...mutedSm, fontSize: 13 }}>{p.bottom.small}</div>
        </div>
      ) : null}
    </>
  );
}

function SplitCard({ p }) {
  return (
    <>
      <div style={{ ...big, marginTop: 14 }}>{p.total ?? '--'}</div>
      <div style={{ marginTop: 26 }}>
        <SplitBar a={p.aNum} b={p.bNum} colorA={p.a.color} colorB={p.b.color} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <div><div style={{ ...big, fontSize: 24 }}>{p.a.value ?? '--'}</div><div style={{ ...mutedSm, fontSize: 13 }}>{p.a.label}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ ...big, fontSize: 24 }}>{p.b.value ?? '--'}</div><div style={{ ...mutedSm, fontSize: 13 }}>{p.b.label}</div></div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
    </>
  );
}

function StackCard({ p }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        {p.rows.map((r, i) => (
          <div key={i}>
            <div style={{ ...big, fontSize: i === 0 ? 32 : 26 }}>{r.value}</div>
            <div style={{ ...mutedSm, fontSize: 13 }}>{r.label}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      {p.note ? <div style={{ ...mutedSm, marginTop: 12, color: COLORS.warn }}>{p.note}</div> : null}
      {p.updated ? <div style={{ ...mutedSm, marginTop: p.note ? 4 : 14, fontSize: 13 }}>{p.updated}</div> : null}
    </>
  );
}

const SHAPES = { RING: RingCard, GAUGE: GaugeCard, SPLIT: SplitCard, STACK: StackCard };

// One metric card from its spec and the store's row for the day.
export default function HealthCard({ spec, row, ctx }) {
  const value = row && row.value;
  if (value === null || value === undefined) {
    return <EmptyCard label={spec.label} glyph={spec.glyph} color={spec.color} reason={(row && row.absent) || 'Not fetched yet for this day.'} guide={spec.guide} tooltip={`${spec.metric} · ${ctx.date}`} />;
  }
  let p;
  try { p = spec.build(value, ctx); } catch (err) {
    return <EmptyCard label={spec.label} glyph={spec.glyph} color={spec.color} reason={`The stored value could not be drawn: ${err.message}`} guide={spec.guide} tooltip={`${spec.metric} · ${ctx.date}`} />;
  }
  const Shape = SHAPES[spec.shape] || StackCard;
  let caption = null;
  try { caption = spec.caption ? spec.caption(value, ctx) : null; } catch (_) { caption = null; }
  const finalNote = row.final ? '' : ' · not final';
  return (
    <CardShell label={spec.label} glyph={spec.glyph} color={spec.color} guide={spec.guide} tooltip={caption ? `${caption}${finalNote}` : null}>
      <Shape spec={spec} p={p} />
    </CardShell>
  );
}
