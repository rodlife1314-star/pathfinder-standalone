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
