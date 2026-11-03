/**
 * Credential redaction for anything that may be shown, returned or logged.
 * Defence in depth: the client never puts headers into errors, but upstream
 * error bodies can echo a key back, so all text passes through here.
 */
const PATTERNS: RegExp[] = [
  /sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /"?(api[_-]?key|authorization|x-api-key|x-goog-api-key)"?\s*[:=]\s*"?[^\s",}]{6,}/gi,
];

export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join("[REDACTED]");
  for (const p of PATTERNS) out = out.replace(p, "[REDACTED]");
  return out;
}

export const truncate = (s: string, n = 500): string => (s.length > n ? `${s.slice(0, n)}… [${s.length - n} more chars]` : s);
