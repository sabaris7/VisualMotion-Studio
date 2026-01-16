
import { EasingType } from '../types';

type EasingFunction = (t: number) => number;

export const easings: Record<Exclude<EasingType, 'custom'>, EasingFunction> & {
  custom: (x1: number, y1: number, x2: number, y2: number) => EasingFunction;
} = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  custom: (x1: number, y1: number, x2: number, y2: number) => {
    return (t: number) => {
      if (t === 0 || t === 1) return t;
      const cx = 3 * x1;
      const bx = 3 * (x2 - x1) - cx;
      const ax = 1 - cx - bx;
      const cy = 3 * y1;
      const by = 3 * (y2 - y1) - cy;
      const ay = 1 - cy - by;
      const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
      const solveCurveX = (x: number) => {
        let t2 = x;
        for (let i = 0; i < 8; i++) {
          const x2 = sampleCurveX(t2) - x;
          if (Math.abs(x2) < 1e-7) return t2;
          const d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
          if (Math.abs(d2) < 1e-7) break;
          t2 = t2 - x2 / d2;
        }
        return t2;
      };
      return ((ay * solveCurveX(t) + by) * solveCurveX(t) + cy) * solveCurveX(t);
    };
  },
};
