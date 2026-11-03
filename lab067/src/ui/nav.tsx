"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SECTIONS = [
  { href: "/", label: "Research Dashboard" },
  { href: "/materials", label: "Element 67 Registry" },
  { href: "/workbench", label: "Euler Workbench" },
  { href: "/simulation", label: "Dynamics Lab" },
  { href: "/orion", label: "ORION Console" },
  { href: "/crucible", label: "Scientific Crucible" },
  { href: "/ledger", label: "Evidence Ledger" },
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Sections">
      <ul className="nav">
        {SECTIONS.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} aria-current={path === s.href ? "page" : undefined}>
              <span className="num">{String(i).padStart(2, "0")}</span>
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
