/**
 * Observables derived from a simulation record (pure post-processing).
 */
import type { Sample } from "./rigid-body.ts";
import { rotate } from "../physics/quaternion.ts";
import { dot, norm, scale, type Vec3 } from "../physics/vec3.ts";

/** World-frame direction of a body-fixed axis at each sample. */
export const bodyAxisInWorld = (samples: readonly Sample[], bodyAxis: Vec3): Vec3[] => samples.map((s) => rotate(s.q, bodyAxis));

/**
 * Unwrapped azimuth [rad] of each vector about the unit direction `about`
 * (precession angle). Uses an orthonormal basis (e1, e2) ⟂ about.
 * Assumes consecutive samples differ by < π in azimuth.
 */
export function unwrappedAzimuth(vectors: readonly Vec3[], about: Vec3): number[] {
  const n = scale(about, 1 / norm(about));
  const trial: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const t = dot(trial, n);
  const e1raw: Vec3 = [trial[0] - t * n[0], trial[1] - t * n[1], trial[2] - t * n[2]];
  const e1 = scale(e1raw, 1 / norm(e1raw));
  const e2: Vec3 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const out: number[] = [];
  let acc = 0, prev: number | null = null;
  for (const v of vectors) {
    const p = Math.atan2(dot(v, e2), dot(v, e1));
    if (prev !== null) {
      let d = p - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      acc += d;
    }
    out.push(acc);
    prev = p;
  }
  return out;
}

/** Polar angle [rad] between each vector and `about` (nutation angle). */
export const polarAngle = (vectors: readonly Vec3[], about: Vec3): number[] =>
  vectors.map((v) => Math.acos(Math.max(-1, Math.min(1, dot(v, about) / (norm(v) * norm(about))))));

/** Potential energy U = −m_world·B [J] at each sample. */
export const dipoleEnergySeries = (samples: readonly Sample[], mBody: Vec3, B: Vec3): number[] =>
  samples.map((s) => -dot(rotate(s.q, mBody), B));
