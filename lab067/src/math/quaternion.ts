/**
 * Unit quaternions for attitude. Convention: q = [w, x, y, z] (scalar first),
 * q rotates BODY-frame vectors into the WORLD frame:  v_world = q ⊗ v_body ⊗ q*.
 */
import type { Vec3 } from "./vec3.ts";

export type Quat = readonly [number, number, number, number];

export const IDENTITY: Quat = [1, 0, 0, 0];

export const qmul = (a: Quat, b: Quat): Quat => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];

export const qnorm = (q: Quat): number => Math.hypot(q[0], q[1], q[2], q[3]);

export function qnormalize(q: Quat): Quat {
  const n = qnorm(q);
  if (!(n > 0) || !Number.isFinite(n)) throw new RangeError("Cannot normalise a zero/non-finite quaternion");
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Rotation of `angle` radians about unit `axis`. */
export function fromAxisAngle(axis: Vec3, angle: number): Quat {
  const n = Math.hypot(axis[0], axis[1], axis[2]);
  if (!(n > 0)) throw new RangeError("Axis must be non-zero");
  const s = Math.sin(angle / 2) / n;
  return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
}

/** Rotate a body-frame vector into the world frame. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const [w, x, y, z] = q;
  return [
    (1 - 2 * (y * y + z * z)) * v[0] + 2 * (x * y - w * z) * v[1] + 2 * (x * z + w * y) * v[2],
    2 * (x * y + w * z) * v[0] + (1 - 2 * (x * x + z * z)) * v[1] + 2 * (y * z - w * x) * v[2],
    2 * (x * z - w * y) * v[0] + 2 * (y * z + w * x) * v[1] + (1 - 2 * (x * x + y * y)) * v[2],
  ];
}

/** Rotate a world-frame vector into the body frame (inverse rotation, Rᵀ v). */
export function rotateInverse(q: Quat, v: Vec3): Vec3 {
  return rotate([q[0], -q[1], -q[2], -q[3]], v);
}

/** Attitude kinematics with BODY-frame angular velocity:  q̇ = ½ q ⊗ (0, ω_body). */
export function qdot(q: Quat, omegaBody: Vec3): Quat {
  const p = qmul(q, [0, omegaBody[0], omegaBody[1], omegaBody[2]]);
  return [0.5 * p[0], 0.5 * p[1], 0.5 * p[2], 0.5 * p[3]];
}
