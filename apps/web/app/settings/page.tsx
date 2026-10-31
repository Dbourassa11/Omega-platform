"use client";

// Settings — profile, connection status, and display preferences.
// Preferences persist via lib/settings (localStorage "omega.settings.v1")
// and broadcast on the "omega:settings" event; the Cosmos page listens
// and applies them live.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type OmegaSettings,
} from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export default function SettingsPage() {
  const [settings, setSettings] = useState<OmegaSettings>(DEFAULT_SETTINGS);
  const [savedNote, setSavedNote] = useState("");

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const update = (next: OmegaSettings) => {
    setSettings(next);
    writeSettings(next);
    setSavedNote("Saved — applies to the Cosmos page.");
    logActivity("settings", "Display preferences updated");
  };

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Profile, connection status, and display preferences for this
        browser.
      </p>

      <div className="card">
        <h2>Profile</h2>
        <p style={{ margin: "0 0 0.25rem", fontSize: "1.1rem" }}>
          <strong>David Charles Bourassa</strong>
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Creator · Quantum Concepts LLC, Santa Fe, New Mexico
        </p>
        <p style={{ marginBottom: 0 }}>
          <span className="badge badge-gold">Creator of record</span>{" "}
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Attribution on every Omega Platform surface reads exactly:
            David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New
            Mexico.
          </span>
        </p>
      </div>

      <div className="card">
        <h2>Connection status</h2>
        <p style={{ marginTop: 0 }}>
          <span className="badge badge-offline">Not connected</span>{" "}
          <strong>Facebook overlay: Not connected — design intent.</strong>
        </p>
        <p className="muted">
          Omega is designed as an overlay for Facebook. No Facebook account,
          page, or data source is connected to this demo, and Omega is not
          affiliated with or endorsed by Meta.
        </p>
        <p>
          <span className="badge badge-offline">Not connected</span>{" "}
          <strong>Meta Model API: not connected (no key)</strong>
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          With no live model key connected, the AI Oracle runs on the
          labeled offline fallback / guardian — it says so on every answer
          it gives.
        </p>
      </div>

      <div className="card">
        <h2>Display preferences</h2>
        <div className="field" style={{ maxWidth: "22rem" }}>
          <label htmlFor="quality-select">Cosmos render quality</label>
          <select
            id="quality-select"
            className="select"
            value={settings.quality}
            onChange={(e) =>
              update({
                ...settings,
                quality: e.target.value as OmegaSettings["quality"],
              })
            }
          >
            <option value="auto">Auto (recommended)</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) =>
              update({ ...settings, reducedMotion: e.target.checked })
            }
          />
          Reduced motion — calm the cosmos animation and skip the intro
          flight
        </label>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          These preferences persist in this browser and{" "}
          <strong>apply to the Cosmos page</strong>: changing them re-creates
          the cosmos engine with the new quality and motion settings, live
          if the Cosmos page is open.
          {savedNote ? ` ${savedNote}` : ""}
        </p>
      </div>

      <div className="card">
        <h2>Your data in this demo</h2>
        <p className="muted" style={{ margin: 0 }}>
          All demo data is synthetic and stored only in this browser
          (localStorage): your activity feed, vault index, share drafts, and
          these settings never leave this device. Clearing the browser&apos;s
          site data removes all of it. No real member data, accounts, or
          vault contents are connected.
        </p>
      </div>
    </>
  );
}
