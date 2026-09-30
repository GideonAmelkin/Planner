import React from 'react';
import { COLORS } from '../shared/styles';
import { glassCard } from './theme';
import { CardHeader } from './ui';

// One section card in the tab's frosted look (theme.js) with the Overview's card head: black icon
// disc, title, grey sub line, `aside` as a chip on the right and `actions` next to it. `span` lets a
// card take the full row. `collapsible` turns the head into a toggle with a chevron and hides the body
// while `open` is false; the caller owns `open`. `dot` is accepted for old callers and ignored.
export default function WorkoutCard({ title, icon = 'dumbbell', sub = null, children, span = 1, aside = null, actions = null, empty = false, emptyText = 'Nothing on this day.', collapsible = false, open = true, onToggle = null }) {
  const shown = !collapsible || open;
  return (
    <div style={{ ...glassCard, gridColumn: span > 1 ? '1 / -1' : 'auto', minWidth: 0 }}>
      <CardHeader icon={icon} title={title} sub={sub} aside={aside} actions={actions} onClick={collapsible ? onToggle : null} open={collapsible ? open : null} />
      {shown ? <div style={{ marginTop: 16 }}>{empty ? <div style={{ color: COLORS.muted, fontSize: 13 }}>{emptyText}</div> : children}</div> : null}
    </div>
  );
}
