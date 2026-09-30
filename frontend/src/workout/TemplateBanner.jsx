import React from 'react';
import { COLORS } from '../shared/styles';
import { templateBanner, titleLines, APP_BLUE, POPPINS } from './art';

// One of the app's template banners, drawn the way the app draws it: its own art with the title in
// two uppercase Poppins lines and "Classic Gym Workout" under it (StrongLifts has no subtitle).
// Used by the Workouts grid and as the header image of the Overview's profile and Last session cards.
// `sub` replaces the subtitle (a home session says "Home workout"); `height` pins the height instead
// of the app's 690 x 240 ratio.
export default function TemplateBanner({ name, sub, onClick = null, selected = false, height = null, radius = 12, size = 14 }) {
  const [a, b] = titleLines(name);
  const strong = /StrongLifts/.test(name);
  const subtitle = sub !== undefined ? sub : strong ? null : 'Classic Gym Workout';
  return (
    <div
      onClick={onClick || undefined}
      title={name}
      role={onClick ? 'button' : 'img'}
      aria-label={name}
      style={{
        position: 'relative', borderRadius: radius, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
        ...(height ? { height } : { aspectRatio: '690 / 240' }), maxWidth: '100%',
        background: `url(${templateBanner(name) || ''}) center / cover, ${COLORS.ink}`,
        outline: selected ? `3px solid ${APP_BLUE}` : 'none', outlineOffset: 2,
        alignSelf: 'start',
      }}
    >
      <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#FFFFFF', fontFamily: POPPINS, fontWeight: 800, fontSize: size, lineHeight: 1.05, textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,.3)' }}>
        {a}<br />{b}
        {subtitle ? <div style={{ fontWeight: 500, fontSize: Math.round(size * 0.78), marginTop: 4, textTransform: 'none' }}>{subtitle}</div> : null}
      </div>
    </div>
  );
}
