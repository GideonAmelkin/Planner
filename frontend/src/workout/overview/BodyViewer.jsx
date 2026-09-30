import React, { Suspense, lazy, useState } from 'react';
import BodyFigure from './BodyFigure';
import { COLORS } from '../../shared/styles';

// The Overview's figure: the 3D body (Body3D, three.js in its own chunk) where WebGL works and the
// model loads; the SVG figure otherwise, with the same dots, popover and buttons.
const Body3D = lazy(() => import('./Body3D'));

const webglWorks = () => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (_) { return false; }
};

export default function BodyViewer(props) {
  const [mode, setMode] = useState(() => (webglWorks() ? '3d' : 'svg'));
  if (mode === 'svg') return <BodyFigure {...props} />;
  return (
    <Suspense fallback={<div style={{ height: 620, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: COLORS.muted }}>Loading the 3D body...</div>}>
      <Body3D {...props} onFail={() => setMode('svg')} />
    </Suspense>
  );
}
