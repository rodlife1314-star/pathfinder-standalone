import type { ReactNode } from "react";
import Link from "next/link";
import { LAB_NAME, LAB_VERSION, PHASE } from "../src/contracts/version.ts";
import "./globals.css";

export const metadata = {
  title: "Pathfinder Lab 067",
  description: "First-principles research scaffold: Holmium, Euler's rigid-body equations, magnetic torque.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <strong>{LAB_NAME}</strong>
          <span className="small">v{LAB_VERSION} · Phase {PHASE} (scaffolding)</span>
          <Link href="/">Status</Link>
          <Link href="/learn/euler">Learn: Euler&apos;s equations</Link>
        </header>
        {children}
      </body>
    </html>
  );
}
