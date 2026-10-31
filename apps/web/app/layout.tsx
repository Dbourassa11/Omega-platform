// Root layout for the Omega Platform web shell — dashboard shell with
// sidebar, topbar, main content and footer.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eternal Quantum Horizons Ω — Omega Platform",
  description:
    "Eternal Quantum Horizons Ω — the Omega Platform dashboard. Designed as an overlay for Facebook (design intent; not affiliated with or endorsed by Meta). Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
        <div className="dash-layout">
          <Sidebar />
          <div className="dash-main">
            <header className="topbar">
              <p className="topbar-product">
                Eternal Quantum Horizons <span aria-hidden="true">Ω</span> —
                Omega Platform
              </p>
              <p className="topbar-note">
                Designed as an overlay for Facebook — design intent; Omega is
                not affiliated with or endorsed by Meta.
              </p>
            </header>
            <main className="page">{children}</main>
            <footer className="dash-footer">
              Creator: David Charles Bourassa · Quantum Concepts LLC, Santa
              Fe, New Mexico
            </footer>
          </div>
        </div>
        </Providers>
      </body>
    </html>
  );
}
