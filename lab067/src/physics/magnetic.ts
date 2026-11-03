/**
 * Point magnetic dipole in a UNIFORM external field (classical, non-relativistic).
 *   τ = m × B          [N·m]   (m in A·m², B in T)
 *   U = − m · B        [J]
 * Assumptions: field uniform over the body (so no net force, only torque);
 * moment m rigidly fixed in the body; no induced magnetisation, hysteresis,
 * eddy currents or demagnetising effects. Real ferromagnets (incl. holmium
 * below its ordering temperatures) violate several of these — NOT modelled.
 */
import { cross, dot, type Vec3 } from "./vec3.ts";

export const magneticTorque = (m: Vec3, B: Vec3): Vec3 => cross(m, B);
export const dipolePotentialEnergy = (m: Vec3, B: Vec3): number => -dot(m, B);

/**
 * Gyroscopic ("fast top") approximation for an axisymmetric body whose moment m
 * lies along its symmetry axis, spinning at ω₃ in uniform B:
 *   Ω_p ≈ − |m||B| / (I₃ ω₃)        [rad/s, about +B̂; sign: right-handed]
 * Valid when ε = I⊥ |m||B| / (I₃ ω₃)² ≪ 1. Leading correction is O(ε).
 * Same mathematics as the heavy symmetric top with m·g·l → |m||B|.
 */
export function fastTopPrecessionRate(mMag: number, bMag: number, I3: number, omega3: number): number {
  return -(mMag * bMag) / (I3 * omega3);
}

/** Small parameter ε of the fast-top approximation (dimensionless). */
export function fastTopEpsilon(Iperp: number, I3: number, mMag: number, bMag: number, omega3: number): number {
  return (Iperp * mMag * bMag) / (I3 * omega3) ** 2;
}
