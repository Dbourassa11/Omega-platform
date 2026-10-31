// Guided Demo — the HACKATHON.md §6 two-minute script as a clickable
// step-through. Beats 1–3 drive the real, live Cosmos engine embedded
// on this page; beats 4–5 are presenter actions on the Oracle page
// (linked, with the exact clicks named — the Oracle page accepts no
// prefilled question); beat 6 closes on the Trust Beacon / PhiSplit
// with the exact split. Works fully offline; all demo data is
// synthetic and labeled in-product.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import DemoGuide from "@/components/DemoGuide";
import "./demo.css";

export const metadata = {
  title: "Guided Demo — Eternal Quantum Horizons Ω",
  description:
    "The two-minute Omega Platform demo as a clickable step-through: cosmos, fly-to, ring switch, Oracle, Guardian refusal, Trust Beacon / PhiSplit close. Synthetic demo data; works offline.",
};

export default function DemoPage() {
  return (
    <>
      <h1 className="page-title">
        Guided Demo <span className="omega">Ω</span>
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        The two-minute demo script (HACKATHON.md §6), beat by beat. Steps
        1–3 use the <strong>real cosmos engine embedded below</strong> —
        its own controls are the demo. Steps 4–5 name the exact clicks to
        make on the Oracle page and link there; nothing on this page
        fakes an action happening elsewhere. Synthetic demo
        constellation — no real member data. Everything on this page
        works offline.
      </p>
      <DemoGuide />
    </>
  );
}
