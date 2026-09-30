import React, { useState } from 'react';
import BodyFigure from './BodyFigure';
import BodyImage from './BodyImage';

// The Overview's figure: the user's own body render with the heat painted on (BodyImage); the SVG figure
// if that image cannot load.
// On the shelf, not imported (so not bundled): Body3D.jsx, heatMaterial.js and anchors.js, a three.js
// body with the heat in the shader. The mesh generated for it from the user's image was rejected on
// 2026-09-29, so it waits for a proper model before the animated version the user wants later.
export default function BodyViewer(props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <BodyFigure {...props} />;
  return <BodyImage {...props} onFail={() => setFailed(true)} />;
}
