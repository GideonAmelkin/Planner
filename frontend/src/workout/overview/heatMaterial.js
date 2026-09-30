import * as THREE from 'three';
import { ANCHORS } from './anchors';

// The 3D body's material and heat map, kept free of React so a headless harness can render the
// model with exactly this code when the anchors are calibrated.
//   material  satin grey-blue like the user's reference render (pale, soft clearcoat, cool sheen)
//   heat      the fragment shader sums a Gaussian glow around each trained group's anchors
//             (anchors.js), weighted by which way the surface faces so front heat never shows on the
//             back, and maps the sum through yellow -> orange -> red as emission
export const MAX_ANCHORS = 24;

export function heatUniforms() {
  return {
    uCount: { value: 0 },
    uAP: { value: Array.from({ length: MAX_ANCHORS }, () => new THREE.Vector3()) },
    uAD: { value: Array.from({ length: MAX_ANCHORS }, () => new THREE.Vector3(0, 0, 1)) },
    uAR: { value: new Array(MAX_ANCHORS).fill(0.1) },
    uAW: { value: new Array(MAX_ANCHORS).fill(0) },
  };
}

// The body material: satin grey-blue like the reference, with the heat added in the shader.
export function bodyMaterial(uniforms) {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#9AA8B9', roughness: 0.32, metalness: 0.08,
    clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.35, sheenColor: new THREE.Color('#DCE6FF'), sheenRoughness: 0.45,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeatPos;\nvarying vec3 vHeatN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvHeatPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvHeatN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vHeatPos;
varying vec3 vHeatN;
uniform int uCount;
uniform vec3 uAP[${MAX_ANCHORS}];
uniform vec3 uAD[${MAX_ANCHORS}];
uniform float uAR[${MAX_ANCHORS}];
uniform float uAW[${MAX_ANCHORS}];`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float heat = 0.0;
vec3 hn = normalize(vHeatN);
for (int i = 0; i < ${MAX_ANCHORS}; i++) {
  if (i >= uCount) break;
  vec3 dv = vHeatPos - uAP[i];
  float rr = uAR[i] * 1.2;
  float g = exp(-dot(dv, dv) / (2.0 * rr * rr));
  float facing = smoothstep(-0.2, 0.45, dot(hn, uAD[i]));
  heat += uAW[i] * g * facing;
}
heat = clamp(heat, 0.0, 1.0);
vec3 hc = mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.45, 0.08), smoothstep(0.15, 0.55, heat));
hc = mix(hc, vec3(0.9, 0.1, 0.05), smoothstep(0.6, 1.0, heat));
diffuseColor.rgb = mix(diffuseColor.rgb, hc, heat * 0.75);
totalEmissiveRadiance += hc * heat * 1.25;`);
  };
  return m;
}

// Feed the shader: every trained group's anchors with a weight from its share of the busiest group.
// Returns the dots (one per trained group, at its first anchor).
export function applyAnchors(uniforms, volumes, max) {
  let i = 0;
  const dots = [];
  for (const key of Object.keys(ANCHORS)) {
    const v = volumes[key] || 0;
    if (!v) continue;
    const w = 0.45 + (0.55 * v) / max;
    const list = ANCHORS[key];
    for (let j = 0; j < list.length && i < MAX_ANCHORS; j += 1) {
      const a = list[j];
      uniforms.uAP.value[i].set(...a.p);
      uniforms.uAD.value[i].set(...a.d).normalize();
      uniforms.uAR.value[i] = a.r;
      uniforms.uAW.value[i] = w;
      i += 1;
      if (j === 0) dots.push({ key, p: a.p, d: a.d });
    }
  }
  uniforms.uCount.value = i;
  return dots;
}

// The studio the body sits in (shared with the calibration harness so its renders match the page):
// a soft room reflection, a cool sky fill, a white key from the upper right and a blue rim from behind,
// kept low so the satin reads mid grey-blue like the reference render.
export function addStage(scene, renderer, RoomEnvironment) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight('#E6EDFF', '#5E6878', 0.55));
  const key = new THREE.DirectionalLight('#FFFFFF', 1.25); key.position.set(1.5, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#9DB6FC', 1.6); rim.position.set(-2.5, 2, -2.5); scene.add(rim);
  const back = new THREE.DirectionalLight('#FFFFFF', 0.6); back.position.set(2, 2.5, -3); scene.add(back);
  return () => { env.dispose(); pmrem.dispose(); };
}
