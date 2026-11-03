/**
 * Canonical JSON: object keys sorted, no whitespace. Rejects values whose JSON
 * encoding would be lossy or ambiguous (NaN, ±Infinity, undefined, functions,
 * symbols, bigint) so a hash always commits to exactly what was recorded.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError(`Non-finite number cannot be canonicalised: ${value}`);
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      return `{${keys.map((k) => {
        if (obj[k] === undefined) throw new TypeError(`Undefined value at key "${k}"`);
        return `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`;
      }).join(",")}}`;
    }
    default:
      throw new TypeError(`Unsupported type for canonical JSON: ${typeof value}`);
  }
}
