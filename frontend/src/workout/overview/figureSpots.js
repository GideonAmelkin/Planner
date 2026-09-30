// Heat spots on the Overview's figure images: the user's own renders of the same body, front and back
// (/workout-body/figure.webp and figure-back.webp, 800 x 1200, backgrounds cut). `x` and `y` are % of the
// image's width and height, `r` the glow radius in % of its width. The first spot of a group on a side
// carries that side's dot. Calibrated 2026-09-29 from marker renders of each image.
export const FIGURE = {
  front: { src: '/workout-body/figure.webp', fallback: '/workout-body/figure.png' },
  back: { src: '/workout-body/figure-back.webp', fallback: '/workout-body/figure-back.png' },
};
export const FIGURE_RATIO = 800 / 1200;

export const SPOTS = {
  front: {
    chest: [{ x: 41.5, y: 25.5, r: 9 }, { x: 58.5, y: 25.5, r: 9 }],
    shoulders: [{ x: 32.5, y: 24, r: 6.5 }, { x: 67.5, y: 24, r: 6.5 }],
    arms: [{ x: 69, y: 31, r: 6 }, { x: 31, y: 31, r: 6 }, { x: 73.5, y: 40, r: 5 }, { x: 26.5, y: 40, r: 5 }],
    core: [{ x: 50, y: 34, r: 7.5 }, { x: 50, y: 40.5, r: 7 }],
    quads: [{ x: 57, y: 56, r: 8.5 }, { x: 43, y: 56, r: 8.5 }, { x: 56, y: 63, r: 6.5 }, { x: 44, y: 63, r: 6.5 }],
  },
  back: {
    back: [{ x: 40, y: 31, r: 8.5 }, { x: 60, y: 31, r: 8.5 }, { x: 50, y: 20, r: 6.5 }],
    shoulders: [{ x: 35, y: 22.5, r: 6 }, { x: 65, y: 22.5, r: 6 }],
    arms: [{ x: 31, y: 31, r: 6 }, { x: 69, y: 31, r: 6 }],
    glutes: [{ x: 44, y: 43, r: 7.5 }, { x: 56, y: 43, r: 7.5 }],
    hamstrings: [{ x: 43, y: 55, r: 7 }, { x: 57, y: 55, r: 7 }],
    calves: [{ x: 42, y: 74, r: 6 }, { x: 58, y: 74, r: 6 }],
  },
};
