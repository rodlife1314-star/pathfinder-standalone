/**
 * Classical 4th-order Runge–Kutta step for y' = f(t, y) on a flat state vector.
 * Global error O(h⁴) for smooth f. Not symplectic: energy drifts slowly over
 * very long runs — the Crucible measures that drift rather than assuming it away.
 */
export type Derivative = (t: number, y: readonly number[]) => number[];

export function rk4Step(f: Derivative, t: number, y: readonly number[], h: number): number[] {
  const n = y.length;
  const tmp = new Array<number>(n);
  const k1 = f(t, y);
  for (let i = 0; i < n; i++) tmp[i] = y[i]! + 0.5 * h * k1[i]!;
  const k2 = f(t + 0.5 * h, tmp);
  for (let i = 0; i < n; i++) tmp[i] = y[i]! + 0.5 * h * k2[i]!;
  const k3 = f(t + 0.5 * h, tmp);
  for (let i = 0; i < n; i++) tmp[i] = y[i]! + h * k3[i]!;
  const k4 = f(t + h, tmp);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = y[i]! + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!);
  return out;
}
