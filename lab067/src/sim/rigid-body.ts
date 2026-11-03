/**
 * Rigid body with a body-fixed magnetic dipole in a uniform, constant world field.
 * State: attitude q (body→world unit quaternion) and body angular velocity ω.
 *
 *   q̇ = ½ q ⊗ (0, ω)
 *   ω̇ = Euler(I, ω, τ_body),   τ_body = m_body × (Rᵀ B_world)
 *
 * Invariants available for validation:
 *   - total energy  E = ½ ω·Iω − (R m_body)·B_world   (constant B ⇒ conserved)
 *   - L_world · B̂   (torque m×B is ⟂ B ⇒ conserved)
 *   - L_world entirely, when B = 0
 */
import { SCHEMA } from "../contracts/evidence.ts";
import { LAB_VERSION } from "../contracts/version.ts";
import { eulerAngularAcceleration, angularMomentumBody, rotationalKineticEnergy } from "../math/euler.ts";
import { checkPrincipalInertia } from "../math/inertia.ts";
import { dipolePotentialEnergy, magneticTorque } from "../math/magnetic.ts";
import { qdot, qnorm, qnormalize, rotate, rotateInverse, type Quat } from "../math/quaternion.ts";
import { isFiniteVec, type Vec3 } from "../math/vec3.ts";
import { rk4Step } from "./rk4.ts";

export interface RigidBodyParams {
  /** Principal moments [kg·m²]. */
  inertia: Vec3;
  /** Body-fixed magnetic moment [A·m²]. */
  magneticMomentBody: Vec3;
  /** Uniform external field, world frame [T]. */
  fieldWorld: Vec3;
}

export interface RigidBodyState {
  q: Quat;
  /** Body-frame angular velocity [rad/s]. */
  omega: Vec3;
}

export interface RunConfig {
  dt: number;
  steps: number;
  /** Record every n-th step (1 = all). */
  sampleEvery: number;
  /** Re-project q onto the unit sphere after each step (a documented, non-physical correction). */
  renormalise: boolean;
}

export interface Sample {
  t: number;
  q: Quat;
  omega: Vec3;
  energy: number;
  angularMomentumWorld: Vec3;
}

export interface SimulationRecord {
  schema: typeof SCHEMA.simulation;
  softwareVersion: string;
  integrator: "RK4";
  assumptions: readonly string[];
  params: RigidBodyParams;
  initial: RigidBodyState;
  config: RunConfig;
  samples: Sample[];
}

export const ASSUMPTIONS = [
  "Rigid body, principal body axes through the centre of mass",
  "Point magnetic dipole fixed in the body",
  "Uniform, time-independent external magnetic field",
  "No gravity, friction, damping, eddy currents or thermal effects",
  "Inertial world frame, non-relativistic",
] as const;

export function validateInputs(p: RigidBodyParams, s: RigidBodyState, c: RunConfig): string[] {
  const errs: string[] = [...checkPrincipalInertia(p.inertia).reasons];
  if (!isFiniteVec(p.magneticMomentBody)) errs.push("magnetic moment not finite");
  if (!isFiniteVec(p.fieldWorld)) errs.push("field not finite");
  if (!isFiniteVec(s.omega)) errs.push("ω not finite");
  if (!s.q.every(Number.isFinite) || Math.abs(qnorm(s.q) - 1) > 1e-9) errs.push("initial q must be a unit quaternion");
  if (!(Number.isFinite(c.dt) && c.dt > 0)) errs.push("dt must be > 0");
  if (!(Number.isInteger(c.steps) && c.steps >= 1)) errs.push("steps must be a positive integer");
  if (!(Number.isInteger(c.sampleEvery) && c.sampleEvery >= 1)) errs.push("sampleEvery must be a positive integer");
  return errs;
}

export function totalEnergy(p: RigidBodyParams, s: RigidBodyState): number {
  return rotationalKineticEnergy(p.inertia, s.omega) + dipolePotentialEnergy(rotate(s.q, p.magneticMomentBody), p.fieldWorld);
}

export const angularMomentumWorld = (p: RigidBodyParams, s: RigidBodyState): Vec3 =>
  rotate(s.q, angularMomentumBody(p.inertia, s.omega));

function derivative(p: RigidBodyParams) {
  return (_t: number, y: readonly number[]): number[] => {
    const q: Quat = [y[0]!, y[1]!, y[2]!, y[3]!];
    const w: Vec3 = [y[4]!, y[5]!, y[6]!];
    const tau = magneticTorque(p.magneticMomentBody, rotateInverse(q, p.fieldWorld));
    return [...qdot(q, w), ...eulerAngularAcceleration(p.inertia, w, tau)];
  };
}

const sample = (p: RigidBodyParams, t: number, s: RigidBodyState): Sample => ({
  t, q: s.q, omega: s.omega, energy: totalEnergy(p, s), angularMomentumWorld: angularMomentumWorld(p, s),
});

export function simulate(params: RigidBodyParams, initial: RigidBodyState, config: RunConfig): SimulationRecord {
  const errs = validateInputs(params, initial, config);
  if (errs.length) throw new RangeError(`Invalid simulation inputs: ${errs.join("; ")}`);
  const f = derivative(params);
  let y = [...initial.q, ...initial.omega];
  let s: RigidBodyState = initial;
  const samples: Sample[] = [sample(params, 0, s)];
  for (let i = 1; i <= config.steps; i++) {
    y = rk4Step(f, (i - 1) * config.dt, y, config.dt);
    let q: Quat = [y[0]!, y[1]!, y[2]!, y[3]!];
    if (config.renormalise) {
      q = qnormalize(q);
      y[0] = q[0]; y[1] = q[1]; y[2] = q[2]; y[3] = q[3];
    }
    s = { q, omega: [y[4]!, y[5]!, y[6]!] };
    if (!y.every(Number.isFinite)) throw new RangeError(`Non-finite state at step ${i}`);
    if (i % config.sampleEvery === 0 || i === config.steps) samples.push(sample(params, i * config.dt, s));
  }
  return {
    schema: SCHEMA.simulation,
    softwareVersion: LAB_VERSION,
    integrator: "RK4",
    assumptions: ASSUMPTIONS,
    params, initial, config, samples,
  };
}
