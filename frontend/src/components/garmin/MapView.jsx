import React, { useEffect, useRef } from 'react';
import { G } from '../../garminTheme';

// Leaflet map (window.L from the cdnjs include in public/index.html). Draws an optional
// polyline of [lat, lon] pairs and fits it; otherwise centers on `center`.
export default function MapView({ polyline = null, center = [25.79, -80.13], zoom = 12, height = 420, style }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    const L = window.L;
    if (!L || !ref.current) return undefined;
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    map.eachLayer((l) => { if (l instanceof L.Polyline || l instanceof L.Marker) map.removeLayer(l); });
    if (polyline && polyline.length > 1) {
      const line = L.polyline(polyline, { color: G.blue, weight: 4 }).addTo(map);
      L.circleMarker(polyline[0], { radius: 6, color: 'white', fillColor: G.green, fillOpacity: 1, weight: 2 }).addTo(map);
      L.circleMarker(polyline[polyline.length - 1], { radius: 6, color: 'white', fillColor: G.metric.heart, fillOpacity: 1, weight: 2 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [20, 20] });
    } else {
      map.setView(center, zoom);
    }
    setTimeout(() => map.invalidateSize(), 50);
    return undefined;
  }, [polyline, center, zoom]);
  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);
  return (
    <div ref={ref} style={{ height, width: '100%', background: '#e9e5e0', position: 'relative', ...style }}>
      {!window.L ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.muted, fontSize: 12 }}>Map unavailable</div> : null}
    </div>
  );
}
