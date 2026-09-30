import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import Icon from '../icons';
import { MUSCLE_GROUPS, groupOf } from '../muscles';
import { fmtVolume } from '../ptParts';
import { COLORS } from '../../shared/styles';
import { roundButton } from '../theme';
import MusclePopover, { POP_W } from './MusclePopover';
import { MODEL_HEIGHT } from './anchors';
import { addStage, applyAnchors, bodyMaterial, heatUniforms } from './heatMaterial';

// The Overview's 3D body (the user's reference, 2026-09-29: a grey, lit figure with a heat map on the
// trained areas, to be animated later). three.js, loaded as its own chunk (React.lazy in BodyViewer).
//   model    /workout-3d/body.glb: generated 2026-09-29 from the user's own reference render (Higgsfield
//            background removal + Meta SAM 3D, meshopt-compressed to 87k triangles, 369 KB), normalised
//            to 1.8 units tall, feet on y = 0, facing +z. Material, lights and heat in heatMaterial.js
//   heat     no per-muscle mesh needed: the material's fragment shader sums a Gaussian glow around each
//            trained group's anchors (anchors.js), weighted by which way the surface faces, and maps
//            the sum through yellow -> orange -> red as emission. Strength = the group's share of the
//            range's volume against the busiest group.
//   camera   orbits the body (drag, turntable only); < > turn it 180 degrees; + / - dolly in and out;
//            a slow sway until the first touch shows it is 3D (off under reduced motion)
//   dots     HTML over the projected anchors, shown only when that side faces the camera; a dot opens
//            the same popover as the SVG figure
// Everything per frame lives in one loop, so a rigged, animated model later only changes where the
// anchors come from. Any failure (no WebGL, model missing) calls onFail and BodyViewer shows the SVG.
const MODEL_URL = '/workout-3d/body.glb';
const DISTANCES = [3.7, 3.1, 2.5, 2.0];
const TARGET_Y = 0.95;

export default function Body3D({ now, before, beforeCount, beforeLabel, unit, top, onOpenTrainer, compact, onFail }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const dotRefs = useRef({});
  const api = useRef({});
  const [ready, setReady] = useState(false);
  const [side, setSide] = useState('front');
  const [zoomIx, setZoomIx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [popPos, setPopPos] = useState(null);

  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => now[g.key] || 0));
  const total = MUSCLE_GROUPS.reduce((t, g) => t + (now[g.key] || 0), 0);
  const trained = MUSCLE_GROUPS.filter((g) => (now[g.key] || 0) > 0).map((g) => g.key);

  // Scene: built once.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      onFail('webgl');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const disposeStage = addStage(scene, renderer, RoomEnvironment);

    // The reference's halo: a soft white glow around the figure. A camera-facing sprite through the body's
    // middle, so the body hides it wherever the body is and it only shows around the silhouette.
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256; haloCanvas.height = 256;
    const hctx = haloCanvas.getContext('2d');
    const grad = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.4)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    hctx.fillStyle = grad; hctx.fillRect(0, 0, 256, 256);
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    haloTex.colorSpace = THREE.SRGBColorSpace;
    // toneMapped off: the page's white stays white instead of turning grey under the body's tone mapping.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, toneMapped: false }));
    halo.scale.set(1.2, 2.3, 1); halo.position.set(0, 0.92, 0); scene.add(halo);

    // Floor ring and a soft contact disc.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.535, 96), new THREE.MeshBasicMaterial({ color: '#AFC2F3', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; scene.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 64), new THREE.MeshBasicMaterial({ color: '#9FB3EA', transparent: true, opacity: 0.25 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.001; scene.add(disc);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    camera.position.set(0, TARGET_Y + 0.15, DISTANCES[0]);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, TARGET_Y, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.minPolarAngle = 1.25;
    controls.maxPolarAngle = 1.75;
    controls.update();

    const uniforms = heatUniforms();
    const material = bodyMaterial(uniforms);
    let model = null;
    let alive = true;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(MODEL_URL, (gltf) => {
      if (!alive) return;
      model = gltf.scene;
      // The generated mesh carries vertex colours and no normals: drop the one, compute the other.
      model.traverse((o) => {
        if (!o.isMesh) return;
        if (o.geometry.attributes.color) o.geometry.deleteAttribute('color');
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        o.material = material;
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = MODEL_HEIGHT / size.y;
      model.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(model);
      const c = box2.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -box2.min.y, -c.z);
      scene.add(model);
      setReady(true);
    }, undefined, () => { if (alive) onFail('model'); });

    // Size to the wrapper.
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(wrap);

    // Motion: the < > turn, the zoom dolly and the idle sway.
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let touched = false;
    controls.addEventListener('start', () => { touched = true; api.current.onDragStart && api.current.onDragStart(); });
    let turn = null; // { from, to, t0 }
    let dist = DISTANCES[0];
    let distGoal = DISTANCES[0];
    const sph = new THREE.Spherical();
    const off = new THREE.Vector3();
    const azimuth = () => { off.copy(camera.position).sub(controls.target); sph.setFromVector3(off); return sph.theta; };
    const setCamera = (theta, r) => {
      off.copy(camera.position).sub(controls.target); sph.setFromVector3(off);
      sph.theta = theta; sph.radius = r;
      off.setFromSpherical(sph); camera.position.copy(controls.target).add(off);
    };
    api.current.turn = (to) => { touched = true; turn = { from: azimuth(), to, t0: performance.now() }; };
    api.current.zoom = (r) => { distGoal = r; };

    // Visibility: no frames while off screen or in a background tab.
    let visible = true;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
    if (io) io.observe(wrap);

    const tmp = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const t0 = performance.now();
    let raf = 0;
    const frame = (now2) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      if (turn) {
        const k = Math.min(1, (now2 - turn.t0) / 700);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        setCamera(turn.from + (turn.to - turn.from) * e, off.copy(camera.position).sub(controls.target).length());
        if (k >= 1) turn = null;
      } else if (!touched && !reduced) {
        setCamera(Math.sin((now2 - t0) / 2600) * 0.22, off.copy(camera.position).sub(controls.target).length());
      }
      if (Math.abs(dist - distGoal) > 0.001) {
        dist += (distGoal - dist) * 0.15;
        setCamera(azimuth(), dist);
      }
      controls.update();
      renderer.render(scene, camera);
      // Dots follow their anchor on screen; hidden when that side faces away.
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const pts = api.current.dots || [];
      for (const d of pts) {
        const el = dotRefs.current[d.key];
        if (!el) continue;
        tmp.set(...d.p);
        toCam.copy(camera.position).sub(tmp).normalize();
        const facing = toCam.dot(new THREE.Vector3(...d.d)) > 0.15;
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * w;
        const y = (-tmp.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        el.style.opacity = facing ? '1' : '0';
        el.style.pointerEvents = facing ? 'auto' : 'none';
        d.screen = { x, y, facing };
      }
    };
    raf = requestAnimationFrame(frame);
    api.current.uniforms = uniforms;

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      controls.dispose();
      material.dispose();
      disposeStage();
      haloTex.dispose();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Heat and dots follow the range.
  useEffect(() => {
    const u = api.current.uniforms;
    if (!u) return;
    const dots = applyAnchors(u, now, max);
    api.current.dots = dots;
  }, [now, max, ready]);

  useEffect(() => { api.current.onDragStart = () => setPicked(null); }, []);

  const flip = () => {
    const next = side === 'front' ? 'back' : 'front';
    setSide(next);
    setPicked(null);
    if (api.current.turn) api.current.turn(next === 'front' ? 0 : Math.PI);
  };
  const zoomTo = (ix) => { setZoomIx(ix); setPicked(null); if (api.current.zoom) api.current.zoom(DISTANCES[ix]); };
  const pick = (key) => {
    if (picked === key) { setPicked(null); return; }
    const d = (api.current.dots || []).find((x) => x.key === key);
    const wrap = wrapRef.current;
    if (!d || !d.screen || compact || !wrap) { setPopPos(null); setPicked(key); return; }
    const left = d.screen.x - POP_W - 22 >= 0 ? d.screen.x - POP_W - 22 : Math.min(wrap.clientWidth - POP_W, d.screen.x + 22);
    setPopPos({ left, top: Math.max(0, d.screen.y - 40) });
    setPicked(key);
  };

  const height = compact ? 460 : 600;
  return (
    <div style={{ position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ alignSelf: 'stretch', fontSize: 12, color: COLORS.muted }}>
        {total ? 'Muscles worked · drag to turn' : 'Muscles worked: no gym sessions in this range'}
      </div>
      <div ref={wrapRef} style={{ position: 'relative', width: '100%', height, touchAction: 'pan-y' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', opacity: ready ? 1 : 0, transition: 'opacity .4s' }} aria-label="3D body with the trained muscles glowing" role="img" />
        {!ready ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: COLORS.muted }}>Loading the 3D body...</div> : null}
        {trained.map((k) => {
          const g = groupOf(k);
          const r = 7 + 5 * Math.sqrt((now[k] || 0) / max);
          return (
            <button
              key={k}
              ref={(el) => { dotRefs.current[k] = el; }}
              type="button"
              onClick={() => pick(k)}
              title={`${g.label}: ${fmtVolume(now[k], unit)} ${unit}`}
              aria-label={`${g.label} details`}
              style={{
                position: 'absolute', left: 0, top: 0, width: r * 2, height: r * 2, borderRadius: '50%', padding: 0, cursor: 'pointer',
                background: g.color, border: '3px solid #FFFFFF', boxShadow: picked === k ? `0 0 0 7px ${g.color}33` : '0 2px 6px rgba(30,50,110,.25)',
                opacity: 0, transition: 'opacity .2s',
              }}
            />
          );
        })}
        <div style={{ position: 'absolute', left: 0, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" style={roundButton()} aria-label="Zoom in" disabled={zoomIx === DISTANCES.length - 1} onClick={() => zoomTo(Math.min(DISTANCES.length - 1, zoomIx + 1))}><Icon name="plus" /></button>
          <button type="button" style={roundButton()} aria-label="Zoom out" disabled={zoomIx === 0} onClick={() => zoomTo(Math.max(0, zoomIx - 1))}><Icon name="minus" /></button>
        </div>
        {picked && popPos ? (
          <MusclePopover muscle={picked} now={now} total={total} before={before} beforeCount={beforeCount} beforeLabel={beforeLabel} unit={unit} top={top}
            onClose={() => setPicked(null)} onOpenTrainer={onOpenTrainer} pos={popPos} />
        ) : null}
      </div>
      {picked && !popPos ? (
        <MusclePopover muscle={picked} now={now} total={total} before={before} beforeCount={beforeCount} beforeLabel={beforeLabel} unit={unit} top={top}
          onClose={() => setPicked(null)} onOpenTrainer={onOpenTrainer} pos={null} />
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 12, color: COLORS.muted }}>
        <button type="button" style={roundButton(28)} aria-label="Turn the body around" onClick={flip}><Icon name="left" size={14} /></button>
        <span style={{ minWidth: 34, textAlign: 'center' }}>{side === 'front' ? 'Front' : 'Back'}</span>
        <button type="button" style={roundButton(28)} aria-label="Turn the body around" onClick={flip}><Icon name="right" size={14} /></button>
      </div>
    </div>
  );
}
