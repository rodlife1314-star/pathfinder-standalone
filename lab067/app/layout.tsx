import type { ReactNode } from "react";
import { LAB_NAME, LAB_VERSION, PHASE } from "../src/contracts/version.ts";
import { Nav } from "../src/ui/nav.tsx";
import { LedgerProvider } from "../src/ui/ledger-context.tsx";
import "./globals.css";

export const metadata = {
  title: "Pathfinder Lab 067",
  description: "Phase 001 research scaffold: holmium, Euler's rigid-body equations, rotational dynamics.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <LedgerProvider>
          <div className="shell">
            <aside className="sidebar">
              <div className="brand">
                <b>{LAB_NAME}</b>
                <span>v{LAB_VERSION} · Phase {PHASE}</span>
              </div>
              <Nav />
              <div className="side-note">
                Exploratory hypothesis. No device exists. Ledger is in-browser memory only — cleared on reload.
              </div>
            </aside>
            <main id="main" className="content">{children}</main>
          </div>
        </LedgerProvider>
      </body>
    </html>
  );
}
