// Heat spots on the Overview's figure image (/workout-body/figure.webp, the user's own render, 800 x 1200,
// front view). `x` and `y` are % of the image's width and height, `r` the glow radius in % of its width.
// The first spot of a group carries its dot. The image has only a front, so back, glutes and hamstrings
// have no spots: BodyImage lists them as chips under the figure. Calibrated 2026-09-29 from a marker render.
export const FIGURE_SRC = '/workout-body/figure.webp';
export const FIGURE_FALLBACK = '/workout-body/figure.png';
export const FIGURE_RATIO = 800 / 1200;

export const SPOTS = {
  chest: [{ x: 41.5, y: 25.5, r: 9 }, { x: 58.5, y: 25.5, r: 9 }],
  shoulders: [{ x: 32.5, y: 24, r: 6.5 }, { x: 67.5, y: 24, r: 6.5 }],
  arms: [{ x: 69, y: 31, r: 6 }, { x: 31, y: 31, r: 6 }, { x: 73.5, y: 40, r: 5 }, { x: 26.5, y: 40, r: 5 }],
  core: [{ x: 50, y: 34, r: 7.5 }, { x: 50, y: 40.5, r: 7 }],
  quads: [{ x: 57, y: 56, r: 8.5 }, { x: 43, y: 56, r: 8.5 }, { x: 56, y: 63, r: 6.5 }, { x: 44, y: 63, r: 6.5 }],
  calves: [{ x: 57.5, y: 78, r: 6 }, { x: 42.5, y: 78, r: 6 }],
};

// Groups the front view cannot show.
export const BACK_ONLY = ['back', 'glutes', 'hamstrings'];
