export interface MotionState {
  reducedMotion: boolean;
  documentVisible: boolean;
  inViewport: boolean;
}

export interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export const shouldAnimate = (state: MotionState): boolean =>
  !state.reducedMotion && state.documentVisible && state.inViewport;

export const clampProgress = (value: number): number => Math.min(1, Math.max(0, value));

export function createStars(
  count: number,
  width: number,
  height: number,
  random: () => number = Math.random,
): Star[] {
  return Array.from({ length: count }, () => ({
    x: random() * width,
    y: random() * height,
    radius: 0.5 + random() * 1.5,
    alpha: Math.round((0.3 + random() * 0.7) * 100) / 100,
  }));
}
