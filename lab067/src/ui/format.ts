/** Display formatting only — never used in calculations. */
export function fmt(x: number | null | undefined, sig = 6): string {
  if (x === null || x === undefined) return "—";
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e6) return String(Number(x.toPrecision(sig)));
  return x.toExponential(Math.max(0, sig - 1)).replace(/e\+?/, "e");
}
