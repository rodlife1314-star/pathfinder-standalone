/**
 * ORION static knowledge templates (Phase 001).
 *
 * Authored by the engineering assistant at build time. Every template is
 * UNVERIFIED_AI_EXPLANATION (or HYPOTHESIS for proposals) and contains NO
 * computed numbers — quantitative work is routed to the Workbench / Simulation.
 */
export interface KnowledgeTemplate {
  id: string;
  title: string;
  keywords: readonly string[];
  explanation: readonly string[];
  equations: readonly string[];
  assumptions: readonly string[];
  experiments: readonly string[];
  openQuestions: readonly string[];
  /** Registry / material ids this template relies on. */
  references: readonly string[];
}

export const KNOWLEDGE: readonly KnowledgeTemplate[] = Object.freeze([
  {
    id: "euler-equations",
    title: "Euler's rigid-body equations",
    keywords: ["euler", "rigid", "body", "angular acceleration", "principal", "inertia"],
    explanation: [
      "Euler's equations are dL/dt = τ written in body-fixed principal axes, where the inertia tensor is constant and diagonal.",
      "The cross-coupling term (I_k − I_j) ω_j ω_k arises because the axes themselves rotate; it lets ω change direction even with zero torque.",
    ],
    equations: ["I₁ω̇₁ = τ₁ − (I₃ − I₂)ω₂ω₃", "I₂ω̇₂ = τ₂ − (I₁ − I₃)ω₃ω₁", "I₃ω̇₃ = τ₃ − (I₂ − I₁)ω₁ω₂"],
    assumptions: ["Rigid body", "Principal axes through the centre of mass", "Inertial world frame", "Non-relativistic"],
    experiments: ["Workbench: set ω along one principal axis and confirm ω̇ = τ/I (no coupling).", "Workbench: set I₁ = I₂ = I₃ and confirm the gyroscopic terms vanish."],
    openQuestions: [],
    references: ["law.euler-rigid-body"],
  },
  {
    id: "angular-momentum",
    title: "Angular momentum and its conservation",
    keywords: ["angular momentum", "conservation", "conserved", "momentum", "|l|"],
    explanation: [
      "With zero external torque the world-frame angular momentum vector L is constant. Its magnitude |L| is also constant and is the same in every frame.",
      "Rotational kinetic energy T = ½ω·Iω is constant too. Both are used by the Crucible to measure numerical error.",
      "L is generally not parallel to ω unless ω lies along a principal axis or the body is spherically symmetric.",
    ],
    equations: ["L = Iω", "dL/dt = τ (world frame)", "T = ½ ω·(Iω) = |L|²/(2I) only for spin about one principal axis"],
    assumptions: ["Isolated rigid body", "No dissipation"],
    experiments: ["Simulation Lab: run any torque-free case and inspect the conservation-error chart; halve Δt and confirm the error falls about 16× (RK4)."],
    openQuestions: [],
    references: ["law.euler-rigid-body"],
  },
  {
    id: "precession",
    title: "Torque-free precession of a symmetric body",
    keywords: ["precession", "precess", "wobble", "nutation", "symmetric top", "disk", "disc"],
    explanation: [
      "For an axisymmetric body (I₁ = I₂ = I⊥) spinning with ω₃ about the symmetry axis, ω circles that axis in the body frame at Ω = (I₃ − I⊥)ω₃ / I⊥.",
      "A flat disk is oblate (I₃ > I⊥, up to I₃ = 2I⊥ for a thin disk), so Ω has the same sign as ω₃.",
      "Seen from the inertial frame, the symmetry axis cones around the fixed vector L.",
    ],
    equations: ["Ω_body = (I₃ − I⊥) ω₃ / I⊥", "Thin disk: I₃ = ½mr², I⊥ = ¼mr² (h → 0)"],
    assumptions: ["Axisymmetric rigid body", "Zero external torque"],
    experiments: ["Simulation Lab: I = (1, 1, 2), ω₀ = (0.1, 0, 10); observe ω₁, ω₂ oscillate with period 2π/Ω."],
    openQuestions: [],
    references: ["law.euler-rigid-body"],
  },
  {
    id: "magnetic-torque",
    title: "Magnetic torque on a dipole",
    keywords: ["magnetic", "torque", "dipole", "field", "tesla", "moment", "m × b", "larmor"],
    explanation: [
      "A point dipole m in a uniform field B feels torque τ = m × B and has potential energy U = −m·B. There is no net force in a uniform field.",
      "Because τ ⟂ B, the component of L along B is conserved; total energy T + U is conserved for a static field.",
      "A real holmium component is not a fixed point dipole: its magnetisation depends on temperature, field, history and crystal axis.",
    ],
    equations: ["τ = m × B", "U = −m·B"],
    assumptions: ["Uniform static field", "Rigid, fixed moment", "No eddy currents or hysteresis"],
    experiments: ["Engine-level only in Phase 001: the Crucible check cons.magnetic verifies energy and L·B̂ conservation."],
    openQuestions: ["What is the actual magnetisation of the holmium component at the operating temperature and field? (material record: PLACEHOLDER)"],
    references: ["law.dipole-torque", "ho.saturation-magnetisation", "ho.anisotropy"],
  },
  {
    id: "intermediate-axis",
    title: "Stability of rotation (intermediate-axis theorem)",
    keywords: ["stability", "stable", "unstable", "intermediate", "tumble", "flip", "dzhanibekov", "tennis racket"],
    explanation: [
      "Free rotation about the axis of largest or smallest moment of inertia is stable; about the intermediate axis it is unstable.",
      "For an axisymmetric disk spinning about its symmetry (largest-moment) axis, torque-free rotation is stable in the ideal rigid case.",
      "With energy dissipation (flexing, eddy currents), only rotation about the MAJOR axis remains stable — an important constraint for any real disk.",
    ],
    equations: ["Linearised: δω̈ = [(I_k − I_i)(I_i − I_j)/(I_j I_k)] ω_i² δω"],
    assumptions: ["Rigid body for the first two statements", "Dissipative case is a known result; not simulated here"],
    experiments: ["Simulation Lab: I = (1, 2, 3), ω₀ = (0.001, 1, 0.001) — watch the flip; repeat about axis 1 or 3."],
    openQuestions: [],
    references: ["law.euler-rigid-body"],
  },
  {
    id: "holmium-magnetism",
    title: "Holmium's low-temperature magnetism",
    keywords: ["holmium", "element 67", "ho", "4f", "rare earth", "rare-earth", "hund", "neel", "néel", "curie", "ferromagnet"],
    explanation: [
      "Holmium is a rare-earth metal. Its magnetism comes mainly from the partially filled 4f shell; Hund's rules for Ho³⁺ (4f¹⁰) give the ⁵I₈ ground term (computed, see Material Registry).",
      "The metal is believed to pass through ordered magnetic phases on cooling. The material record holds NO sourced transition temperatures yet.",
    ],
    equations: ["g_J = 1 + [J(J+1) + S(S+1) − L(L+1)] / [2J(J+1)]", "μ_eff = g_J √(J(J+1)) μ_B"],
    assumptions: ["Free-ion approximation for the derived values"],
    experiments: [],
    openQuestions: [
      "Sourced values for ordering temperatures, saturation magnetisation and anisotropy are required before any holmium-specific torque model.",
      "Which crystal axis of a holmium component would be aligned with the disk's spin axis?",
    ],
    references: ["ho3.ground-term", "ho3.mu-eff", "ho.neel-temperature", "ho.conical-transition", "ho.anisotropy"],
  },
  {
    id: "cryogenic-constraints",
    title: "Cryogenic constraints",
    keywords: ["cryogenic", "cryo", "low temperature", "helium", "nitrogen", "cooling", "kelvin", "cold"],
    explanation: [
      "Operating holmium in an ordered magnetic phase implies cryogenic temperatures, which bring heat-load, thermal-contraction and material-property constraints.",
      "No thermal model exists in Phase 001; the Crucible lists it as NOT IMPLEMENTED.",
    ],
    equations: [],
    assumptions: [],
    experiments: [],
    openQuestions: ["What heat load would a spinning disk impose (eddy-current and radiative)?", "What coolant temperature is required relative to sourced transition temperatures?"],
    references: ["cryo.ln2-boiling-point", "cryo.lhe4-boiling-point", "ho.specific-heat-lowT", "ho.thermal-conductivity-lowT"],
  },
  {
    id: "shaftless-disk",
    title: "The shaftless-disk hypothesis",
    keywords: ["shaftless", "hypothesis", "levitation", "levitate", "bearing", "suspended", "float"],
    explanation: [
      "Status: HYPOTHESIS. No device exists and nothing in this application demonstrates feasibility.",
      "A torque-free simulation shows only how an ideal rigid body rotates once it is spinning; it says nothing about how the disk is supported.",
      "Support without a shaft requires a separate, stable suspension mechanism. Earnshaw's theorem (established) rules out stable static levitation by static fields from fixed magnets and charges alone; known exceptions rely on diamagnetism, superconductors, active feedback or spin stabilisation — each needs its own analysis.",
    ],
    equations: [],
    assumptions: [],
    experiments: ["Before any suspension analysis: define the disk geometry and obtain sourced holmium properties."],
    openQuestions: [
      "What suspension mechanism is proposed, and does it evade Earnshaw's theorem? On what principle?",
      "What is the full force and torque budget, including field gradients (absent in the uniform-field model)?",
    ],
    references: ["law.euler-rigid-body", "law.dipole-torque"],
  },
  {
    id: "energy-constraints",
    title: "Energy constraints",
    keywords: ["energy", "power", "generate", "generation", "efficiency", "perpetual", "free energy", "extract"],
    explanation: [
      "For a torque-free rigid body, rotational kinetic energy is exactly constant: rotation alone cannot produce energy.",
      "Any energy extracted from a spinning disk reduces its kinetic energy; dissipation (friction, eddy currents, hysteresis) only lowers it further.",
      "A static magnetic field does no net work over a closed cycle of a rigid dipole's orientation (U = −m·B is a conservative potential).",
    ],
    equations: ["dT/dt = τ·ω", "τ = 0 ⇒ T = constant"],
    assumptions: ["Classical mechanics, energy conservation (established law)"],
    experiments: ["Simulation Lab: confirm T is constant to integrator precision for any torque-free run."],
    openQuestions: [],
    references: ["law.euler-rigid-body", "law.dipole-torque"],
  },
]);
