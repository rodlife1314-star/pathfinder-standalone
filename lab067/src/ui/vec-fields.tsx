"use client";
export type Triple = [string, string, string];

export function VecFields({ legend, symbol, unit, value, onChange, invalid }: {
  legend: string; symbol: string; unit: string; value: Triple; onChange: (v: Triple) => void; invalid?: readonly boolean[];
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="fields">
        {value.map((v, i) => (
          <label className="field" key={i}>
            <span>{symbol}<sub>{i + 1}</sub> <span className="unit">[{unit}]</span></span>
            <input inputMode="decimal" spellCheck={false} autoComplete="off" value={v} aria-invalid={invalid?.[i] ? true : undefined}
              onChange={(e) => { const n = [...value] as Triple; n[i] = e.target.value; onChange(n); }} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
