"use client";
/**
 * Minimal, dependency-free SVG line chart.
 * One y-axis only. Crosshair + tooltip on pointer and keyboard (←/→).
 * Legend shown for ≥ 2 series; direct end-labels for ≤ 4. Data table in <details>.
 */
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fmt } from "./format.ts";

export interface Series {
  name: string;
  color: string;
  values: readonly number[];
}

interface Props {
  title: string;
  x: readonly number[];
  xLabel: string;
  yLabel: string;
  series: readonly Series[];
  scale?: "linear" | "log";
  /** For log scale: values ≤ this are drawn at the floor. */
  logFloor?: number;
  height?: number;
  note?: string;
}

const W = 720, PAD = { l: 92, r: 70, t: 12, b: 38 };

function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!(hi > lo)) return [lo];
  const step0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

export function LineChart({ title, x, xLabel, yLabel, series, scale = "linear", logFloor = 1e-17, height = 250, note }: Props) {
  const id = useId();
  const [idx, setIdx] = useState<number | null>(null);
  const H = height;
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;

  const geo = useMemo(() => {
    const tf = (v: number) => (scale === "log" ? Math.log10(Math.max(Math.abs(v), logFloor)) : v);
    const all = series.flatMap((s) => s.values.map(tf)).filter(Number.isFinite);
    let lo = Math.min(...all), hi = Math.max(...all);
    let flatNote: string | null = null;
    if (scale === "linear") {
      const span = hi - lo, mid = (hi + lo) / 2;
      // Avoid magnifying floating-point noise into apparent structure.
      if (span <= 1e-9 * Math.max(Math.abs(mid), 1e-300)) {
        const pad = Math.abs(mid) > 0 ? Math.abs(mid) * 0.01 : 1;
        lo = mid - pad; hi = mid + pad;
        flatNote = "Variation is below plotting resolution (±1% band shown). See the conservation-error chart for the actual deviation.";
      } else { lo -= span * 0.05; hi += span * 0.05; }
    } else { lo = Math.floor(lo); hi = Math.max(Math.ceil(hi), lo + 1); }
    const x0 = x[0] ?? 0, x1 = x.at(-1) ?? 1;
    const sx = (v: number) => PAD.l + ((v - x0) / (x1 - x0 || 1)) * pw;
    const sy = (v: number) => PAD.t + (1 - (tf(v) - lo) / (hi - lo || 1)) * ph;
    const yt = scale === "log" ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((_, i, a) => a.length <= 7 || i % Math.ceil(a.length / 6) === 0) : niceTicks(lo, hi);
    const paths = series.map((s) => s.values.map((v, i) => `${i ? "L" : "M"}${sx(x[i]!).toFixed(2)},${sy(v).toFixed(2)}`).join(""));
    return { sx, sy, yt, xt: niceTicks(x0, x1, 6), paths, flatNote, yPos: (t: number) => PAD.t + (1 - (t - lo) / (hi - lo || 1)) * ph };
  }, [x, series, scale, logFloor, pw, ph]);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const x0 = x[0] ?? 0, x1 = x.at(-1) ?? 1;
    const t = x0 + ((px - PAD.l) / pw) * (x1 - x0);
    let best = 0;
    for (let i = 1; i < x.length; i++) if (Math.abs(x[i]! - t) < Math.abs(x[best]! - t)) best = i;
    setIdx(best);
  };
  const key = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = Math.max(1, Math.round(x.length / 50));
    if (e.key === "ArrowRight") { setIdx((i) => Math.min(x.length - 1, (i ?? -1) + step)); e.preventDefault(); }
    if (e.key === "ArrowLeft") { setIdx((i) => Math.max(0, (i ?? x.length) - step)); e.preventDefault(); }
    if (e.key === "Escape") setIdx(null);
  };
  // Direct end-labels: only for 2–4 short-named series; nudged apart to avoid collisions.
  const endLabels = useMemo(() => {
    if (series.length < 2 || series.length > 4 || series.some((s) => s.name.length > 4)) return [];
    const ls = series.map((s) => ({ name: s.name, y: geo.sy(s.values.at(-1) ?? 0) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ls.length; i++) if (ls[i]!.y - ls[i - 1]!.y < 13) ls[i]!.y = ls[i - 1]!.y + 13;
    return ls;
  }, [series, geo]);
  // Enough significant figures that adjacent ticks never print identically.
  const ySig = (() => {
    if (scale === "log" || geo.yt.length < 2) return 4;
    const step = Math.abs(geo.yt[1]! - geo.yt[0]!);
    const big = Math.max(...geo.yt.map(Math.abs));
    return Math.min(15, Math.max(3, Math.ceil(Math.log10(big / step)) + 2));
  })();
  const ylab = (t: number) => (scale === "log" ? `1e${t}` : fmt(t, ySig));
  const tableStep = Math.max(1, Math.ceil(x.length / 40));
  const tipLeft = idx === null ? 0 : (geo.sx(x[idx]!) / W) * 100;

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="small" style={{ color: "var(--text)", fontWeight: 600, marginBottom: 2 }}>{title}</figcaption>
      {series.length >= 2 && (
        <div className="legend" aria-hidden="true">
          {series.map((s) => <span key={s.name}><span className="k" style={{ background: s.color }} />{s.name}</span>)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-d`} tabIndex={0}
        onPointerMove={pick} onPointerLeave={() => setIdx(null)} onKeyDown={key} onBlur={() => setIdx(null)}>
        <desc id={`${id}-d`}>{`${title}. ${yLabel} versus ${xLabel}. Use left and right arrow keys to read values; a data table follows the chart.`}</desc>
        {geo.yt.map((t) => (
          <g key={`y${t}`}>
            <line className="grid-line" x1={PAD.l} x2={W - PAD.r} y1={geo.yPos(t)} y2={geo.yPos(t)} />
            <text x={PAD.l - 8} y={geo.yPos(t) + 4} textAnchor="end">{ylab(t)}</text>
          </g>
        ))}
        {geo.xt.map((t) => (
          <text key={`x${t}`} x={geo.sx(t)} y={H - PAD.b + 16} textAnchor="middle">{fmt(t, 4)}</text>
        ))}
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        <text x={PAD.l + pw / 2} y={H - 4} textAnchor="middle">{xLabel}</text>
        <text x={14} y={PAD.t + ph / 2} textAnchor="middle" transform={`rotate(-90 14 ${PAD.t + ph / 2})`}>{yLabel}</text>
        {geo.paths.map((d, i) => <path key={series[i]!.name} className="series" d={d} stroke={series[i]!.color} />)}
        {endLabels.map((l) => (
          <text key={`l${l.name}`} className="dlabel" x={W - PAD.r + 6} y={l.y + 4}>{l.name}</text>
        ))}
        {idx !== null && (
          <g>
            <line className="crosshair" x1={geo.sx(x[idx]!)} x2={geo.sx(x[idx]!)} y1={PAD.t} y2={H - PAD.b} />
            {series.map((s) => <circle key={`c${s.name}`} cx={geo.sx(x[idx]!)} cy={geo.sy(s.values[idx]!)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {idx !== null && (
        <div className="tooltip" style={tipLeft > 60 ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}>
          <div className="muted">{xLabel} = <span className="mono">{fmt(x[idx]!, 6)}</span></div>
          {series.map((s) => (
            <div key={`t${s.name}`}><span className="k" style={{ background: s.color }} /><span className="v">{fmt(s.values[idx]!, 8)}</span> <span className="muted">{s.name}</span></div>
          ))}
        </div>
      )}
      {(geo.flatNote || note) && <p className="small muted" style={{ margin: "4px 0 0" }}>{geo.flatNote ?? note}</p>}
      <details style={{ marginTop: 6 }}>
        <summary>Data table ({Math.ceil(x.length / tableStep)} of {x.length} samples)</summary>
        <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto", marginTop: 6 }}>
          <table>
            <thead><tr><th className="num">{xLabel}</th>{series.map((s) => <th key={s.name} className="num">{s.name}</th>)}</tr></thead>
            <tbody>
              {x.map((xv, i) => (i % tableStep === 0 || i === x.length - 1) && (
                <tr key={i}><td className="num">{fmt(xv, 6)}</td>{series.map((s) => <td key={s.name} className="num">{fmt(s.values[i]!, 10)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
