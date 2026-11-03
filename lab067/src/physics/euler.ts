/**
 * Euler's rigid-body equations in the principal-axis body frame.
 *
 *   I1 ω̇1 = (I2 − I3) ω2 ω3 + τ1
 *   I2 ω̇2 = (I3 − I1) ω3 ω1 + τ2
 *   I3 ω̇3 = (I1 − I2) ω1 ω2 + τ3
 *
 * Equivalent vector form: I ω̇ + ω × (I ω) = τ, with I diagonal.
 * Assumptions: rigid body; body axes are principal axes through the centre of
 * mass; inertial (non-accelerating) reference for the world frame; τ is the
 * external torque about the centre of mass, expressed in BODY axes.
 */
import { cross, dot, hadamard, type Vec3 } from "./vec3.ts";

/** Angular acceleration ω̇ [rad/s²] for principal moments I [kg·m²], ω [rad/s], τ [N·m] (body frame). */
export function eulerAngularAcceleration(I: Vec3, omega: Vec3, torque: Vec3): Vec3 {
  const [I1, I2, I3] = I;
  const [w1, w2, w3] = omega;
  return [
    ((I2 - I3) * w2 * w3 + torque[0]) / I1,
    ((I3 - I1) * w3 * w1 + torque[1]) / I2,
    ((I1 - I2) * w1 * w2 + torque[2]) / I3,
  ];
}

/** Body-frame angular momentum L = I ω  [kg·m²/s]. */
export const angularMomentumBody = (I: Vec3, omega: Vec3): Vec3 => hadamard(I, omega);

/** Rotational kinetic energy T = ½ ω · (I ω)  [J]. */
export const rotationalKineticEnergy = (I: Vec3, omega: Vec3): number => 0.5 * dot(omega, hadamard(I, omega));

/** Gyroscopic term ω × (I ω) [N·m] — the reason ω̇ ≠ τ/I for a spinning body. */
export const gyroscopicTerm = (I: Vec3, omega: Vec3): Vec3 => cross(omega, hadamard(I, omega));

/**
 * Torque-free axisymmetric body (I1 = I2 = I⊥): body-frame precession rate of ω
 * about the symmetry axis,  Ω = (I3 − I⊥) ω3 / I⊥  [rad/s]. Analytic result
 * used by the Crucible as an independent reference.
 */
export function symmetricTopBodyPrecessionRate(Iperp: number, I3: number, omega3: number): number {
  return ((I3 - Iperp) * omega3) / Iperp;
}

/** Analytic ω(t) for the torque-free symmetric top with ω(0) = (a, b, ω3). */
export function symmetricTopOmega(Iperp: number, I3: number, omega0: Vec3, t: number): Vec3 {
  const Omega = symmetricTopBodyPrecessionRate(Iperp, I3, omega0[2]);
  const c = Math.cos(Omega * t), s = Math.sin(Omega * t);
  return [omega0[0] * c - omega0[1] * s, omega0[0] * s + omega0[1] * c, omega0[2]];
}

/**
 * Per-axis breakdown in the Operator's sign convention (Phase 001 brief):
 *
 *   I₁ ω̇₁ = τ₁ − (I₃ − I₂) ω₂ ω₃
 *   I₂ ω̇₂ = τ₂ − (I₁ − I₃) ω₃ ω₁
 *   I₃ ω̇₃ = τ₃ − (I₂ − I₁) ω₁ ω₂
 *
 * Algebraically identical to eulerAngularAcceleration (tested). Every
 * intermediate value is exposed so the workbench can show the working.
 */
export interface EulerAxisWorking {
  axis: 1 | 2 | 3;
  /** I_i [kg·m²] */
  inertia: number;
  /** (I_k − I_j) [kg·m²], e.g. (I₃ − I₂) for axis 1 */
  inertiaDifference: number;
  /** ω_j ω_k [rad²/s²] */
  omegaProduct: number;
  /** (I_k − I_j) ω_j ω_k  [N·m] — the gyroscopic coupling term (component of ω × Iω) */
  gyroscopicTerm: number;
  /** τ_i [N·m] */
  torque: number;
  /** τ_i − gyroscopic term [N·m] */
  netEffectiveTorque: number;
  /** ω̇_i [rad/s²] */
  angularAcceleration: number;
}

export interface EulerWorking {
  axes: [EulerAxisWorking, EulerAxisWorking, EulerAxisWorking];
  angularMomentumBody: Vec3;
  angularMomentumMagnitude: number;
  kineticEnergy: number;
}

export function eulerWorking(I: Vec3, omega: Vec3, torque: Vec3): EulerWorking {
  // cyclic index triples (i, j, k): axis i couples ω_j ω_k with (I_k − I_j)
  const triples = [[0, 1, 2], [1, 2, 0], [2, 0, 1]] as const;
  const axes = triples.map(([i, j, k]) => {
    const inertiaDifference = I[k] - I[j];
    const omegaProduct = omega[j] * omega[k];
    const gyroscopicTerm = inertiaDifference * omegaProduct;
    const netEffectiveTorque = torque[i] - gyroscopicTerm;
    return {
      axis: (i + 1) as 1 | 2 | 3,
      inertia: I[i],
      inertiaDifference,
      omegaProduct,
      gyroscopicTerm,
      torque: torque[i],
      netEffectiveTorque,
      angularAcceleration: netEffectiveTorque / I[i],
    };
  }) as EulerWorking["axes"];
  const L = angularMomentumBody(I, omega);
  return { axes, angularMomentumBody: L, angularMomentumMagnitude: Math.hypot(...L), kineticEnergy: rotationalKineticEnergy(I, omega) };
}
