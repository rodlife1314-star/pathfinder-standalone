import type { ValidationStatus } from "../contracts/evidence.ts";

export function StatusBadge({ status }: { status: ValidationStatus }) {
  return <span className={`status s-${status.replace(" ", "-")}`}>{status}</span>;
}
