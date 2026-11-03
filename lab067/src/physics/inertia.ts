/**
 * Principal moments of inertia for ideal homogeneous solids (SI: kg·m²).
 * Assumption: uniform density, perfect geometry, axes through the centre of mass.
 * Returned as [I1, I2, I3] about body x, y, z.
 */
import type { Vec3 } from "./vec3.ts";

function requirePositive(name: string, x: number): void {
  if (!(Number.isFinite(x) && x > 0)) throw new RangeError(`${name} must be finite and > 0 (got ${x})`);
}

/** Solid sphere, mass m [kg], radius r [m]:  I = (2/5) m r² about every axis. */
export function solidSphere(m: number, r: number): Vec3 {
  requirePositive("m", m); requirePositive("r", r);
  const I = (2 / 5) * m * r * r;
  return [I, I, I];
}

/** Solid cylinder, symmetry axis = body z. I_z = ½ m r², I_x = I_y = (1/12) m (3r² + h²). */
export function solidCylinder(m: number, r: number, h: number): Vec3 {
  requirePositive("m", m); requirePositive("r", r); requirePositive("h", h);
  const Ix = (m * (3 * r * r + h * h)) / 12;
  return [Ix, Ix, 0.5 * m * r * r];
}

/** Solid cuboid with edge lengths a (x), b (y), c (z):  I_x = (1/12) m (b² + c²), etc. */
export function solidCuboid(m: number, a: number, b: number, c: number): Vec3 {
  requirePositive("m", m); requirePositive("a", a); requirePositive("b", b); requirePositive("c", c);
  return [(m * (b * b + c * c)) / 12, (m * (a * a + c * c)) / 12, (m * (a * a + b * b)) / 12];
}

export interface InertiaCheck {
  valid: boolean;
  reasons: string[];
}

/**
 * Physical admissibility of principal moments: each must be positive and finite,
 * and they must satisfy the triangle inequalities I_i + I_j ≥ I_k. A set that
 * violates these cannot belong to any real mass distribution.
 */
export function checkPrincipalInertia(I: Vec3, relTol = 1e-12): InertiaCheck {
  const reasons: string[] = [];
  I.forEach((x, i) => {
    if (!(Number.isFinite(x) && x > 0)) reasons.push(`I${i + 1} = ${x} is not finite and positive`);
  });
  const [a, b, c] = I;
  const tol = relTol * (Math.abs(a) + Math.abs(b) + Math.abs(c));
  if (a + b < c - tol) reasons.push(`Triangle inequality violated: I1 + I2 < I3`);
  if (b + c < a - tol) reasons.push(`Triangle inequality violated: I2 + I3 < I1`);
  if (a + c < b - tol) reasons.push(`Triangle inequality violated: I1 + I3 < I2`);
  return { valid: reasons.length === 0, reasons };
}
