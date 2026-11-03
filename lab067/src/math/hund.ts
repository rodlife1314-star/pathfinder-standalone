/**
 * Hund's rules for a single open 4f shell (l = 3), free-ion approximation,
 * Russell–Saunders (LS) coupling. Deterministic derivation — used for Ho³⁺ (4f¹⁰).
 *
 * Limitations: ignores crystal-field splitting, J-mixing and exchange in the
 * solid; real holmium-metal moments are empirical quantities that must be cited.
 */
export interface HundResult {
  electrons: number;
  S: number;
  L: number;
  J: number;
  termSymbol: string;
  /** Landé g-factor g_J (dimensionless). */
  gJ: number;
  /** Effective paramagnetic moment g_J √(J(J+1)) in units of μ_B. */
  muEffInBohrMagnetons: number;
  /** Saturation moment g_J · J in units of μ_B. */
  muSatInBohrMagnetons: number;
}

const L_LETTERS = "SPDFGHIKLMNOQ"; // spectroscopic letters (J skipped by convention)

export function hund4f(n: number): HundResult {
  if (!Number.isInteger(n) || n < 1 || n > 13) throw new RangeError("4f occupancy must be an integer 1..13");
  const ml = [3, 2, 1, 0, -1, -2, -3];
  // Rule 1 & 2: fill spin-up first in order of decreasing m_l, then spin-down.
  const up = Math.min(n, 7);
  const down = n - up;
  const S = (up - down) / 2;
  const L = Math.abs(ml.slice(0, up).reduce((s, x) => s + x, 0) + ml.slice(0, down).reduce((s, x) => s + x, 0));
  // Rule 3: less than half-filled → J = |L − S|; more than half → J = L + S.
  const J = n < 7 ? Math.abs(L - S) : n === 7 ? S : L + S;
  const gJ = J === 0 ? NaN : 1 + (J * (J + 1) + S * (S + 1) - L * (L + 1)) / (2 * J * (J + 1));
  const twoS1 = 2 * S + 1;
  const Jstr = Number.isInteger(J) ? `${J}` : `${2 * J}/2`;
  return {
    electrons: n,
    S, L, J,
    termSymbol: `${twoS1}${L_LETTERS[L]}${Jstr}`,
    gJ,
    muEffInBohrMagnetons: gJ * Math.sqrt(J * (J + 1)),
    muSatInBohrMagnetons: gJ * J,
  };
}
