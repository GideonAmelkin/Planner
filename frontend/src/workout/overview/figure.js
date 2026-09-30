// Drawing data for the Overview's body figure (viewBox 0 0 300 600, centre line x = 150).
// Every body and muscle shape is the figure's LEFT half; BodyFigure mirrors it around x = 150,
// so the two sides always match. Hotspots are single points (not mirrored), one per group,
// placed on either side so they do not crowd.

export const VIEW_W = 300;
export const VIEW_H = 600;

export const HEAD = { cx: 150, cy: 54, rx: 24, ry: 30 };
export const NECK = 'M137 76 L163 76 L168 100 L132 100 Z';

// Torso, upper arm, forearm, thigh, lower leg (left half).
export const BODY_HALF = [
  'M150 96 C130 96 108 99 97 108 C86 118 88 138 94 160 C99 182 108 204 113 232 C115 252 110 272 108 292 L150 292 Z',
  'M100 114 C84 110 72 126 66 150 C60 176 56 204 56 226 L74 232 C80 208 88 184 94 164 C100 146 108 124 100 114 Z',
  'M57 222 C49 250 43 280 39 312 L53 316 C61 288 69 258 76 230 Z',
  'M109 286 C104 330 106 382 114 422 L145 422 C149 382 151 332 150 290 Z',
  'M114 418 C108 460 110 502 118 544 L139 544 C145 502 147 460 145 418 Z',
];
export const HAND = { cx: 42, cy: 334, rx: 8, ry: 17, rotate: 12 };
export const FOOT = { cx: 128, cy: 554, rx: 15, ry: 8 };

// Muscle regions per side (left half, mirrored). Core is one shape on the centre line.
const DELTOID = 'M97 108 C84 116 80 136 86 152 C94 142 102 126 110 114 Z';
const UPPER_ARM = 'M92 130 C80 134 72 156 68 182 C66 196 66 206 68 212 L80 214 C84 196 90 176 96 158 C100 146 100 134 92 130 Z';
export const MUSCLE_HALF = {
  front: {
    shoulders: DELTOID,
    chest: 'M114 116 C128 110 146 111 148 118 L148 160 C136 166 118 164 106 152 C102 138 106 124 114 116 Z',
    arms: UPPER_ARM,
    quads: 'M113 302 C109 342 112 382 120 410 L142 410 C146 382 147 342 145 302 Z',
  },
  back: {
    shoulders: DELTOID,
    back: 'M150 102 C136 103 120 107 110 116 C106 140 109 170 118 198 C128 220 140 230 150 232 Z',
    arms: UPPER_ARM,
    glutes: 'M150 262 C134 257 115 262 111 282 C109 300 121 314 150 311 Z',
    hamstrings: 'M113 318 C110 350 113 384 120 410 L142 410 C146 384 147 350 145 318 Z',
    calves: 'M117 432 C111 460 114 490 122 512 L140 512 C146 482 146 452 141 432 Z',
  },
};
export const CORE = 'M128 168 h44 a12 12 0 0 1 12 12 v76 a12 12 0 0 1 -12 12 h-44 a12 12 0 0 1 -12 -12 v-76 a12 12 0 0 1 12 -12 z';

// Faint definition lines (sternum, pec line, abs, quad and shin lines).
export const LINES = {
  front: 'M150 112 V286 M118 162 C130 170 142 168 150 160 M136 196 H164 M134 222 H166 M134 248 H166 M122 330 C128 360 130 390 128 410 M126 440 C124 470 126 500 130 530',
  back: 'M150 104 V300 M118 150 C128 170 138 182 150 188 M150 262 V310 M130 330 V400 M128 440 C126 470 128 500 131 530',
};

// Which groups each side shows, and where their hotspot sits.
export const HOTSPOTS = {
  front: { chest: [130, 138], shoulders: [92, 126], arms: [220, 178], core: [150, 214], quads: [172, 352] },
  back: { back: [130, 162], shoulders: [208, 126], arms: [80, 178], glutes: [170, 288], hamstrings: [128, 362], calves: [172, 470] },
};
