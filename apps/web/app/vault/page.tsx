"use client";

/**
 * Sovereign Vault — local demo vault page.
 * Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
 *
 * Encryption is real (WebCrypto AES-GCM via @omega/vault-core, item keys
 * wrapped per consent ring with AES-KW). Storage is this browser only:
 * item records live in localStorage, ring keys are exported raw into
 * localStorage for the demo, and oversized items stay in memory for the
 * session. Nothing leaves the device.
 */

import { useEffect, useRef, useState } from "react";

import { RING_TYPES } from "@omega/consent-core";
import type { RingType } from "@omega/consent-core";
import {
  VAULT_CORE_STATUS,
  decryptItem,
  encryptItem,
  exportRingKey,
  generateItemKey,
  generateRingKey,
  importRingKey,
  sha256Hex,
  unwrapItemKey,
  wrapItemKey,
} from "@omega/vault-core";

import { logActivity } from "@/lib/activity";

import "./vault.css";

const INDEX_KEY = "omega.vault.index.v1";
const RING_KEYS_KEY = "omega.vault.ringkeys.v1";
const PERSIST_LIMIT_BYTES = 1_000_000; // 1 MB

interface VaultItemRecord {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  ring: RingType;
  iv: string;
  /** Base64 ciphertext when persisted; null when session-only (see in-memory map). */
  ciphertext: string | null;
  wrappedKey: string;
  sha256: string;
  stored: boolean;
  addedAt: number;
}

interface VerifyState {
  ok: boolean;
  text: string;
}

type RingKeyStore = Partial<Record<RingType, string>>;

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function readRingKeyStore(): RingKeyStore {
  try {
    const raw = globalThis.localStorage.getItem(RING_KEYS_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as RingKeyStore;
  } catch {
    return {};
  }
}

function readPersistedIndex(): VaultItemRecord[] {
  try {
    const raw = globalThis.localStorage.getItem(INDEX_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as VaultItemRecord[];
  } catch {
    return [];
  }
}

/** Persist only the stored records; returns false on quota/serialization failure. */
function persistIndex(records: VaultItemRecord[]): boolean {
  try {
    const persisted = records.filter((r) => r.stored && r.ciphertext !== null);
    globalThis.localStorage.setItem(INDEX_KEY, JSON.stringify(persisted));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `vault-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export default function VaultPage() {
  const [items, setItems] = useState<VaultItemRecord[]>([]);
  const [selectedRing, setSelectedRing] = useState<RingType>("family");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [verify, setVerify] = useState<Record<string, VerifyState>>({});
  const [downloads, setDownloads] = useState<Record<string, string>>({});

  const itemsRef = useRef<VaultItemRecord[]>([]);
  const ringKeyCache = useRef(new Map<RingType, CryptoKey>());
  const sessionCiphertexts = useRef(new Map<string, string>());
  const downloadsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const persisted = readPersistedIndex();
    itemsRef.current = persisted;
    setItems(persisted);
  }, []);

  function commitItems(next: VaultItemRecord[]): void {
    itemsRef.current = next;
    setItems(next);
  }

  /** Lazily generate/import the CryptoKey for a ring; raw export persists for the demo. */
  async function ensureRingKey(ring: RingType): Promise<CryptoKey> {
    const cached = ringKeyCache.current.get(ring);
    if (cached !== undefined) return cached;

    const store = readRingKeyStore();
    const existing = store[ring];
    if (existing !== undefined) {
      const imported = await importRingKey(existing);
      ringKeyCache.current.set(ring, imported);
      return imported;
    }

    const generated = await generateRingKey();
    store[ring] = await exportRingKey(generated);
    try {
      globalThis.localStorage.setItem(RING_KEYS_KEY, JSON.stringify(store));
    } catch {
      setNotice(
        "Ring key could not be persisted (storage quota). Items for this ring stay session-only in practice — keep this tab open.",
      );
    }
    ringKeyCache.current.set(ring, generated);
    logActivity("vault", `Generated a new demo ring key for the "${ring}" ring`);
    return generated;
  }

  async function addFile(file: File, ring: RingType): Promise<void> {
    const buffer = await file.arrayBuffer();
    const digest = await sha256Hex(buffer);
    const itemKey = await generateItemKey();
    const encrypted = await encryptItem(itemKey, buffer);
    const ringKey = await ensureRingKey(ring);
    const wrappedKey = await wrapItemKey(itemKey, ringKey);

    const record: VaultItemRecord = {
      id: newId(),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      ring,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      wrappedKey,
      sha256: digest,
      stored: true,
      addedAt: Date.now(),
    };

    if (file.size <= PERSIST_LIMIT_BYTES) {
      const candidate = [...itemsRef.current, record];
      if (persistIndex(candidate)) {
        commitItems(candidate);
        logActivity(
          "vault",
          `Encrypted "${file.name}" (${formatBytes(file.size)}) into the "${ring}" ring and stored it locally`,
        );
        return;
      }
      // Quota error → fall through to the session-only fallback.
    }

    const sessionRecord: VaultItemRecord = {
      ...record,
      ciphertext: null,
      stored: false,
    };
    sessionCiphertexts.current.set(record.id, encrypted.ciphertext);
    commitItems([...itemsRef.current, sessionRecord]);
    // Re-persist so previously stored records survive alongside the new one.
    persistIndex(itemsRef.current);
    logActivity(
      "vault",
      `Encrypted "${file.name}" (${formatBytes(file.size)}) into the "${ring}" ring — session only (over 1 MB or storage quota)`,
    );
  }

  async function handleFiles(files: FileList | File[]): Promise<void> {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      for (const file of list) {
        await addFile(file, selectedRing);
      }
      setNotice(
        `Encrypted ${list.length} file${list.length === 1 ? "" : "s"} into the "${selectedRing}" ring.`,
      );
    } catch {
      setNotice(
        "Encryption failed for at least one file. Nothing was uploaded anywhere — the vault is local only.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decryptAndVerify(item: VaultItemRecord): Promise<void> {
    setVerify((prev) => ({
      ...prev,
      [item.id]: { ok: false, text: "Decrypting…" },
    }));
    try {
      const ciphertext = item.ciphertext ?? sessionCiphertexts.current.get(item.id);
      if (ciphertext === undefined) {
        throw new Error("ciphertext unavailable (session data was lost)");
      }
      const ringKey = await ensureRingKey(item.ring);
      const itemKey = await unwrapItemKey(item.wrappedKey, ringKey);
      const plaintext = await decryptItem(itemKey, {
        iv: item.iv,
        ciphertext,
      });
      const recomputed = await sha256Hex(plaintext);
      if (recomputed !== item.sha256) {
        setVerify((prev) => ({
          ...prev,
          [item.id]: {
            ok: false,
            text: "Verification failed — SHA-256 mismatch after decrypt.",
          },
        }));
        logActivity("vault", `Verification FAILED for "${item.name}" (hash mismatch)`);
        return;
      }

      const previousUrl = downloadsRef.current[item.id];
      if (previousUrl !== undefined) {
        URL.revokeObjectURL(previousUrl);
      }
      const blob = new Blob([plaintext], {
        type: item.mimeType === "" ? "application/octet-stream" : item.mimeType,
      });
      const url = URL.createObjectURL(blob);
      downloadsRef.current = { ...downloadsRef.current, [item.id]: url };
      setDownloads(downloadsRef.current);
      setVerify((prev) => ({
        ...prev,
        [item.id]: { ok: true, text: "Verified ✓ — integrity match" },
      }));
      logActivity(
        "vault",
        `Decrypted and verified "${item.name}" — SHA-256 integrity match`,
      );
    } catch {
      setVerify((prev) => ({
        ...prev,
        [item.id]: {
          ok: false,
          text: "Verification failed — decrypt or unwrap error (wrong ring key or tampered data).",
        },
      }));
      logActivity("vault", `Verification FAILED for "${item.name}" (decrypt/unwrap error)`);
    }
  }

  function removeItem(item: VaultItemRecord): void {
    const next = itemsRef.current.filter((r) => r.id !== item.id);
    commitItems(next);
    persistIndex(next);
    sessionCiphertexts.current.delete(item.id);
    const url = downloadsRef.current[item.id];
    if (url !== undefined) {
      URL.revokeObjectURL(url);
      const rest = { ...downloadsRef.current };
      delete rest[item.id];
      downloadsRef.current = rest;
      setDownloads(rest);
    }
    setVerify((prev) => {
      const rest = { ...prev };
      delete rest[item.id];
      return rest;
    });
    logActivity("vault", `Removed "${item.name}" from the local vault`);
  }

  return (
    <section>
      <h2 className="page-title">Sovereign Vault</h2>
      <p>
        Local demo vault — encryption is real (WebCrypto AES-GCM), storage is
        this browser only, nothing leaves the device.
      </p>
      <p className="muted">
        Each file gets its own AES-GCM item key. That key is wrapped with
        AES-KW under the selected consent ring&rsquo;s key, so one ring&rsquo;s
        key cannot open another ring&rsquo;s items. Core status:{" "}
        {VAULT_CORE_STATUS}.
      </p>
      <p className="vault-warning">
        Demo only — raw ring keys in browser storage. A production vault never
        does this.
      </p>

      <div className="card vault-controls">
        <label htmlFor="vault-ring-select">
          Ring for new uploads
          <select
            id="vault-ring-select"
            className="select"
            value={selectedRing}
            onChange={(event) => {
              setSelectedRing(event.target.value as RingType);
            }}
          >
            {RING_TYPES.map((ring) => (
              <option key={ring} value={ring}>
                {ring}
              </option>
            ))}
          </select>
        </label>

        <div
          className={dragging ? "vault-dropzone vault-dropzone-active" : "vault-dropzone"}
          role="button"
          tabIndex={0}
          aria-label="Drop files to encrypt them into the selected ring, or activate to choose files"
          onClick={() => {
            document.getElementById("vault-file-input")?.click();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              document.getElementById("vault-file-input")?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <p>Drag &amp; drop files here to encrypt them locally.</p>
          <p className="muted">
            Files up to 1 MB persist in this browser; larger files are kept
            for this session only.
          </p>
        </div>

        <label htmlFor="vault-file-input">
          Or choose files
          <input
            id="vault-file-input"
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

        {busy ? <p className="muted">Encrypting…</p> : null}
        {notice !== null ? (
          <p role="status" className="muted">
            {notice}
          </p>
        ) : null}
      </div>

      <h3>Vault items</h3>
      {items.length === 0 ? (
        <p className="muted">No items yet. Encrypt a file to see it here.</p>
      ) : (
        <ul className="vault-list">
          {items.map((item) => {
            const state = verify[item.id];
            const downloadUrl = downloads[item.id];
            return (
              <li key={item.id} className="card vault-item">
                <div className="vault-item-head">
                  <strong>{item.name}</strong>
                  <span className="badge">{item.ring}</span>
                  <span className="badge">
                    {item.stored ? "stored locally" : "session only"}
                  </span>
                </div>
                <p className="muted vault-item-meta">
                  {formatBytes(item.size)} · SHA-256 {item.sha256.slice(0, 12)}…
                </p>
                {state !== undefined ? (
                  <p
                    role="status"
                    className={state.ok ? "vault-verified" : "vault-failed"}
                  >
                    {state.text}
                  </p>
                ) : null}
                <div className="vault-item-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      void decryptAndVerify(item);
                    }}
                  >
                    Decrypt &amp; verify
                  </button>
                  {downloadUrl !== undefined ? (
                    <a className="btn" href={downloadUrl} download={item.name}>
                      Download decrypted
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      removeItem(item);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="muted vault-footer">
        <p>
          Local demo by David Charles Bourassa · Quantum Concepts LLC, Santa
          Fe, New Mexico. Encryption happens on this device; no server receives
          your files or keys.
        </p>
      </footer>
    </section>
  );
}
