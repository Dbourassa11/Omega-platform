"use client";

// Import Archive — Facebook "Download Your Information" ingest.
// Parsing runs 100% locally in this browser via @omega/meta-export:
// files are read as text in memory, nothing is uploaded, and the
// imported dataset lives only in memory (a reload resets it).
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import { useRef, useState } from "react";
import Link from "next/link";
import {
  generateSyntheticExport,
  SYNTHETIC_EXPORT_OWNER_NAME,
  type ExportFileEntry,
  type RingOverride,
} from "@omega/meta-export";
import { RING_TYPES, type RingType } from "@omega/consent-core";
import { useDataset } from "@/lib/dataset";
import { logActivity } from "@/lib/activity";
import "./import.css";

const RING_SOURCE_LABELS: Record<string, string> = {
  list: "list",
  inferred: "inferred",
  default: "default",
  override: "override",
};

async function filesToEntries(files: FileList | File[]): Promise<ExportFileEntry[]> {
  const list = Array.from(files);
  return Promise.all(
    list.map(async (file) => ({
      path: file.webkitRelativePath || file.name,
      content: await file.text(),
    })),
  );
}

export default function ImportPage() {
  const { state, setImported, applyOverrides, resetToSynthetic } = useDataset();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [emptyResult, setEmptyResult] = useState(false);
  const folderRef = useRef<HTMLInputElement | null>(null);

  const graph = state.kind === "imported" ? state.graph : null;

  function handleSynthetic() {
    setBusy(true);
    setEmptyResult(false);
    try {
      const files = generateSyntheticExport();
      const result = setImported(files);
      setNotice(
        `Loaded the synthetic sample export — ${result.people.length} fictional people for ${result.ownerName}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | File[]) {
    if (Array.from(files).length === 0) return;
    setBusy(true);
    setNotice(null);
    setEmptyResult(false);
    try {
      const entries = await filesToEntries(files);
      const result = setImported(entries);
      if (result.people.length === 0) {
        setEmptyResult(true);
        setNotice(null);
      } else {
        setNotice(
          `Parsed ${entries.length} file${entries.length === 1 ? "" : "s"} locally — ${result.people.length} people found for ${result.ownerName}.`,
        );
      }
    } catch {
      setNotice(
        "Reading those files failed. Nothing was uploaded anywhere — import runs locally in this browser only.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleRingChange(personId: string, ring: RingType) {
    const override: RingOverride = { personId, ring };
    applyOverrides([override]);
    logActivity("import", `Manually reclassified a person into the "${ring}" ring`);
  }

  return (
    <section>
      <h1 className="page-title">
        Import Archive <span className="omega">Ω</span>
      </h1>
      <p>
        Import a Facebook &ldquo;Download Your Information&rdquo; export and
        see your own network placed into the four consent rings. Processing
        runs 100% locally in this browser — files are read into memory,
        parsed here, and never leave this device.
      </p>
      <p className="import-privacy">
        <strong>Imported archive — processed locally, nothing uploaded</strong>
      </p>
      <p className="muted">
        The imported dataset is held in memory only: reloading this page
        resets it to the synthetic demo. No server receives your export,
        your files, or the parsed graph.
      </p>

      <div className="card import-controls">
        <h2 style={{ marginTop: 0 }}>Choose an archive</h2>

        <div>
          <p style={{ marginTop: 0 }}>
            <strong>Synthetic sample.</strong> A fully fictional sample
            export — synthetic / fictional data for the fictional owner{" "}
            {SYNTHETIC_EXPORT_OWNER_NAME}, generated in your browser so you
            can try the whole flow without touching a real archive.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={handleSynthetic}
          >
            Load the synthetic sample export
          </button>
        </div>

        <div>
          <p style={{ marginTop: 0 }}>
            <strong>Your own export.</strong> Pick the unzipped
            &ldquo;Download Your Information&rdquo; folder, or select the
            individual JSON files from it (friends, friend lists, posts,
            albums, and message threads are recognized; anything else is
            ignored).
          </p>
          <div className="import-intake-row">
            <label htmlFor="import-folder-input">
              Choose the export folder
              <input
                id="import-folder-input"
                className="input"
                type="file"
                ref={(el) => {
                  folderRef.current = el;
                  if (el) {
                    el.setAttribute("webkitdirectory", "");
                    el.setAttribute("directory", "");
                  }
                }}
                onChange={(event) => {
                  if (event.target.files !== null) {
                    void handleFiles(event.target.files);
                  }
                  event.target.value = "";
                }}
              />
            </label>
            <label htmlFor="import-files-input">
              Or choose individual files
              <input
                id="import-files-input"
                className="input"
                type="file"
                multiple
                onChange={(event) => {
                  if (event.target.files !== null) {
                    void handleFiles(event.target.files);
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {busy ? <p className="muted">Parsing locally…</p> : null}
        {notice !== null ? (
          <p role="status" className="muted">
            {notice}
          </p>
        ) : null}
        {graph !== null && state.kind === "imported" ? (
          <p className="muted" style={{ margin: 0 }}>
            Imported at {new Date(state.importedAt).toLocaleString()} ·{" "}
            <button
              type="button"
              className="btn"
              onClick={() => {
                resetToSynthetic();
                setEmptyResult(false);
                setNotice("Active dataset reset to the synthetic demo.");
              }}
            >
              Reset to synthetic demo
            </button>
          </p>
        ) : null}
      </div>

      {emptyResult && graph !== null && graph.people.length === 0 ? (
        <div className="card">
          <h2>No recognizable export files found</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            None of the files provided matched a known Facebook export
            shape, so no people were found. Try choosing the whole unzipped
            export folder, or include the friends list, friend lists, or
            message files from the export.
          </p>
        </div>
      ) : null}

      {graph !== null && graph.people.length > 0 ? (
        <>
          <div className="card">
            <h2>Import summary — {graph.ownerName}</h2>
            {graph.synthetic ? (
              <p>
                <span className="badge badge-gold">Synthetic / fictional</span>{" "}
                <span className="muted">
                  This graph came from the synthetic sample export for{" "}
                  {SYNTHETIC_EXPORT_OWNER_NAME} — no real personal data.
                </span>
              </p>
            ) : (
              <p>
                <span className="badge">Imported archive</span>{" "}
                <span className="muted">
                  Imported archive — processed locally, nothing uploaded.
                </span>
              </p>
            )}
            <div className="import-summary-grid">
              <div>
                <span className="stat-label">People</span>
                <span className="stat-value">{graph.people.length}</span>
              </div>
              <div>
                <span className="stat-label">Family</span>
                <span className="stat-value">{graph.summary.peoplePerRing.family}</span>
              </div>
              <div>
                <span className="stat-label">Friends</span>
                <span className="stat-value">{graph.summary.peoplePerRing.friends}</span>
              </div>
              <div>
                <span className="stat-label">Work</span>
                <span className="stat-value">{graph.summary.peoplePerRing.work}</span>
              </div>
              <div>
                <span className="stat-label">Public</span>
                <span className="stat-value">{graph.summary.peoplePerRing.public}</span>
              </div>
              <div>
                <span className="stat-label">Unclassified</span>
                <span className="stat-value">{graph.summary.unclassifiedCount}</span>
              </div>
            </div>
            <p style={{ marginBottom: 0 }}>
              {graph.summary.postCount} posts · {graph.summary.mediaCount}{" "}
              media · {graph.summary.threadCount} threads
            </p>
            <p className="muted">
              Unclassified people sit in the Family ring — the most
              restrictive ring — until reclassified here. Deny by default:
              a person with no classification claim is placed in the
              innermost ring, visible only in the innermost ring view,
              rather than being published into an outer ring by default.
            </p>
            <h3>How each ring was decided</h3>
            <ul className="import-legend">
              <li>
                <span className="badge">override</span>
                <span>
                  Manual reclassification in the table below — an explicit
                  choice always wins over every other rule.
                </span>
              </li>
              <li>
                <span className="badge">list</span>
                <span>
                  Friend-list membership (Family → family, Close Friends →
                  friends, work / colleague lists → work, Acquaintances →
                  public); a person on several lists gets the most
                  restrictive ring.
                </span>
              </li>
              <li>
                <span className="badge">inferred</span>
                <span>
                  Message frequency — 25 or more messages infers the
                  Friends ring.
                </span>
              </li>
              <li>
                <span className="badge">default</span>
                <span>
                  No list, no inference — deny by default into Family, the
                  most restrictive ring, until a human classifies them.
                </span>
              </li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              <Link href="/cosmos" className="btn btn-gold">
                View in Cosmos →
              </Link>
            </p>
          </div>

          <div className="card">
            <h2>People — reclassify by ring</h2>
            <p className="muted">
              Changing a ring applies a manual override and re-parses the
              retained export locally. Overrides take precedence over list
              membership and inference.
            </p>
            <div className="import-table-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Ring</th>
                    <th scope="col">Source</th>
                    <th scope="col">Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.people.map((person) => (
                    <tr key={person.id}>
                      <td>{person.name}</td>
                      <td>
                        <select
                          className="select import-ring-select"
                          aria-label={`Ring for ${person.name}`}
                          value={person.ring}
                          onChange={(event) => {
                            handleRingChange(
                              person.id,
                              event.target.value as RingType,
                            );
                          }}
                        >
                          {RING_TYPES.map((ring) => (
                            <option key={ring} value={ring}>
                              {ring}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className="badge">
                          {RING_SOURCE_LABELS[person.ringSource] ??
                            person.ringSource}
                        </span>
                      </td>
                      <td>{person.messageCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <footer className="muted import-footer">
        <p>
          Local import by David Charles Bourassa · Quantum Concepts LLC,
          Santa Fe, New Mexico. Parsing happens on this device; no server
          receives your files.
        </p>
      </footer>
    </section>
  );
}
