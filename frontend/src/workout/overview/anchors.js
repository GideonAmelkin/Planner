// Heat anchors for the 3D body (Body3D.jsx), in scene units after the model is normalised (feet on
// y = 0, 1.8 tall, centred on x = 0 and z = 0, facing +z). `p` is a point just under the skin at the
// muscle's centre, `d` the way that muscle faces (front +z, back -z, shoulders and arms angled out) so
// front heat never shows on the back, `r` the glow radius. The first anchor of a group carries its dot,
// so it is a front spot where the group has one.
// Calibrated 2026-09-29 on body.glb (generated from the user's reference render with Higgsfield SAM 3D)
// by raycasting each muscle centre onto the mesh from the front or back (the harness is in the session
// notes). When the model is rigged for animation, each anchor becomes an offset from a bone.
export const MODEL_HEIGHT = 1.8;

export const ANCHORS = {
  chest: [
    { p: [0.08, 1.367, 0.079], d: [0, 0, 1], r: 0.075 },
    { p: [-0.083, 1.365, 0.1], d: [0, 0, 1], r: 0.075 },
  ],
  shoulders: [
    { p: [0.186, 1.433, -0.007], d: [0.55, 0.35, 0.75], r: 0.055 },
    { p: [-0.188, 1.433, 0.045], d: [-0.55, 0.35, 0.75], r: 0.055 },
    { p: [0.185, 1.434, -0.129], d: [0.55, 0.35, -0.75], r: 0.055 },
    { p: [-0.182, 1.436, -0.096], d: [-0.55, 0.35, -0.75], r: 0.055 },
  ],
  arms: [
    { p: [0.243, 1.246, -0.035], d: [0.5, 0, 0.85], r: 0.05 },
    { p: [-0.25, 1.248, 0.031], d: [-0.5, 0, 0.85], r: 0.05 },
    { p: [0.244, 1.251, -0.096], d: [0.5, 0, -0.85], r: 0.05 },
    { p: [-0.251, 1.252, -0.053], d: [-0.5, 0, -0.85], r: 0.05 },
  ],
  core: [
    { p: [-0.004, 1.13, 0.069], d: [0, 0, 1], r: 0.07 },
    { p: [0.046, 1.04, 0.068], d: [0, 0, 1], r: 0.06 },
    { p: [-0.048, 1.04, 0.075], d: [0, 0, 1], r: 0.06 },
  ],
  quads: [
    { p: [0.101, 0.702, 0.057], d: [0, 0, 1], r: 0.08 },
    { p: [-0.104, 0.702, 0.089], d: [0, 0, 1], r: 0.08 },
    { p: [0.104, 0.573, 0.02], d: [0, 0, 1], r: 0.06 },
    { p: [-0.103, 0.576, 0.052], d: [0, 0, 1], r: 0.06 },
  ],
  back: [
    { p: [0.095, 1.276, -0.133], d: [0, 0, -1], r: 0.085 },
    { p: [-0.097, 1.276, -0.115], d: [0, 0, -1], r: 0.085 },
    { p: [0.008, 1.456, -0.139], d: [0, 0, -1], r: 0.07 },
  ],
  glutes: [
    { p: [0.071, 0.923, -0.108], d: [0, 0, -1], r: 0.075 },
    { p: [-0.076, 0.923, -0.103], d: [0, 0, -1], r: 0.075 },
  ],
  hamstrings: [
    { p: [0.098, 0.663, -0.063], d: [0, 0, -1], r: 0.075 },
    { p: [-0.103, 0.664, -0.044], d: [0, 0, -1], r: 0.075 },
  ],
  calves: [
    { p: [0.108, 0.342, -0.105], d: [0, 0, -1], r: 0.06 },
    { p: [-0.122, 0.342, -0.053], d: [0, 0, -1], r: 0.06 },
  ],
};
