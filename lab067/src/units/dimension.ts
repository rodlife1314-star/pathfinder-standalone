/**
 * Dimensional analysis over the seven SI base dimensions.
 * Exponent order: [M (kg), L (m), T (s), I (A), Θ (K), N (mol), J (cd)].
 *
 * Known limitation (by design of SI): plane angle (rad) is dimensionless, so
 * torque (N·m) and energy (J) share the dimension M·L²·T⁻². Dimensional
 * consistency is therefore a NECESSARY, not SUFFICIENT, check.
 */
export type Dimension = readonly [number, number, number, number, number, number, number];

const SYMBOLS = ["kg", "m", "s", "A", "K", "mol", "cd"] as const;

export const dim = (M = 0, L = 0, T = 0, I = 0, Th = 0, N = 0, J = 0): Dimension =>
  Object.freeze([M, L, T, I, Th, N, J]) as Dimension;

export const mulDim = (a: Dimension, b: Dimension): Dimension =>
  dim(...(a.map((x, i) => x + b[i]!) as [number, number, number, number, number, number, number]));

export const divDim = (a: Dimension, b: Dimension): Dimension =>
  dim(...(a.map((x, i) => x - b[i]!) as [number, number, number, number, number, number, number]));

export const powDim = (a: Dimension, p: number): Dimension =>
  dim(...(a.map((x) => x * p) as [number, number, number, number, number, number, number]));

export const sameDim = (a: Dimension, b: Dimension): boolean => a.every((x, i) => x === b[i]);

export function formatDim(d: Dimension): string {
  const parts = d
    .map((e, i) => (e === 0 ? "" : e === 1 ? SYMBOLS[i]! : `${SYMBOLS[i]}^${e}`))
    .filter(Boolean);
  return parts.length ? parts.join("·") : "1 (dimensionless)";
}

/** Named dimensions used by Phase 001. */
export const D = {
  dimensionless: dim(),
  mass: dim(1),
  length: dim(0, 1),
  time: dim(0, 0, 1),
  current: dim(0, 0, 0, 1),
  temperature: dim(0, 0, 0, 0, 1),
  angularVelocity: dim(0, 0, -1), // rad/s, rad dimensionless
  angularAcceleration: dim(0, 0, -2),
  momentOfInertia: dim(1, 2), // kg·m²
  angularMomentum: dim(1, 2, -1), // kg·m²/s
  torque: dim(1, 2, -2), // N·m
  energy: dim(1, 2, -2), // J
  magneticMoment: dim(0, 2, 0, 1), // A·m²  (= J/T)
  magneticFluxDensity: dim(1, 0, -2, -1), // T = kg·s⁻²·A⁻¹
  permeability: dim(1, 1, -2, -2), // N/A²
} as const;
