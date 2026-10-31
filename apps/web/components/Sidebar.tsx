"use client";

// Dashboard sidebar navigation for the Omega Platform web shell.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS: readonly { href: string; label: string; hint: string }[] = [
  { href: "/", label: "Overview", hint: "Platform at a glance" },
  { href: "/public", label: "Public Platform", hint: "Disclosure-filtered public shell" },
  { href: "/cosmos", label: "Cosmos", hint: "3D consent cosmos, universe & multiverse" },
  { href: "/import", label: "Import Archive", hint: "Facebook export — parsed locally, nothing uploaded" },
  { href: "/vault", label: "Vault", hint: "Encrypted local vault" },
  { href: "/creative", label: "Creative Suites", hint: "Art, music, video, writing" },
  { href: "/share", label: "Share Center", hint: "Ring-scoped sharing" },
  { href: "/communities", label: "Communities", hint: "Demo-local communities & feed" },
  { href: "/oracle", label: "AI Oracle", hint: "Offline / guardian assistant" },
  { href: "/agents", label: "Omni-AI Agents", hint: "8-agent fabric — scoped, receipted" },
  { href: "/review", label: "Review Workstation", hint: "Approve, veto, monitor agent runs" },
  { href: "/garden", label: "Eternal Garden", hint: "Legacy Mirror — synthetic demo archive" },
  { href: "/consent", label: "Consent Rings", hint: "Exact-ring access, deny by default" },
  { href: "/privacy", label: "Privacy Control Center", hint: "Universal access engine — domains, purposes, passes" },
  { href: "/phisplit", label: "PhiSplit", hint: "φ-proportioned value routing" },
  { href: "/control", label: "Operator Control", hint: "System status, revocation, runbooks" },
  { href: "/settings", label: "Settings", hint: "Profile, connections, display" },
];

export default function Sidebar() {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true">
          Ω
        </span>
        <span className="brand-text">
          <strong>Omega Platform</strong>
          <small>Eternal Quantum Horizons Ω</small>
        </span>
      </div>
      <nav aria-label="Primary">
        <ul className="nav-list">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={active ? "nav-link active" : "nav-link"}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-hint">{item.hint}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="sidebar-foot">
        Creator: David Charles Bourassa
        <br />
        Quantum Concepts LLC · Santa Fe, NM
      </p>
    </aside>
  );
}
