/// <reference lib="dom" />
/**
 * @omega/vault-core — Sovereign Vault crypto core.
 * Creator: David Charles Bourassa
 *
 * Real in-browser encryption via WebCrypto (globalThis.crypto.subtle,
 * available in browsers and Node 20+), per the ADR vault standard:
 *  - every item is encrypted with its own AES-GCM 256 key and a random
 *    12-byte IV (GCM authentication: tampered ciphertext is rejected);
 *  - every item key is wrapped with AES-KW 256 under a per-ring key, so
 *    a key wrapped for one consent ring cannot be opened by another
 *    ring's key (AES-KW integrity check fails) — the ring boundary.
 *
 * Local scope only: this package performs cryptography. It does not
 * persist anything and nothing it produces leaves the device unless a
 * caller explicitly stores/transmits it.
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToBytes,
  bytesToBase64,
} from "./base64.js";

export {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToBytes,
  bytesToBase64,
} from "./base64.js";

export const VAULT_CORE_STATUS =
  "WORKING — local WebCrypto AES-GCM items + AES-KW ring-wrapped keys; no server persistence" as const;

/** An encrypted item: base64 IV (12 random bytes) + base64 AES-GCM ciphertext. */
export interface EncryptedItem {
  iv: string;
  ciphertext: string;
}

function subtle(): SubtleCrypto {
  const cryptoImpl = globalThis.crypto;
  if (cryptoImpl === undefined || cryptoImpl.subtle === undefined) {
    throw new Error(
      "@omega/vault-core: WebCrypto (globalThis.crypto.subtle) is unavailable in this environment.",
    );
  }
  return cryptoImpl.subtle;
}

function asCryptoKey(key: CryptoKey | CryptoKeyPair): CryptoKey {
  if (key instanceof CryptoKey) {
    return key;
  }
  throw new Error("@omega/vault-core: expected a single CryptoKey.");
}

/**
 * Generate a per-ring key: AES-KW 256, extractable, wrap/unwrap only.
 * One ring key per consent ring; item keys are wrapped under it.
 */
export async function generateRingKey(): Promise<CryptoKey> {
  return asCryptoKey(
    await subtle().generateKey({ name: "AES-KW", length: 256 }, true, [
      "wrapKey",
      "unwrapKey",
    ]),
  );
}

/** Export a ring key as base64 of its raw bytes. */
export async function exportRingKey(key: CryptoKey): Promise<string> {
  const raw = await subtle().exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

/** Import a ring key previously produced by {@link exportRingKey}. */
export async function importRingKey(b64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(b64);
  return subtle().importKey("raw", raw, { name: "AES-KW" }, true, [
    "wrapKey",
    "unwrapKey",
  ]);
}

/**
 * Generate a fresh per-item key: AES-GCM 256, extractable (so it can be
 * wrapped), encrypt/decrypt usages.
 */
export async function generateItemKey(): Promise<CryptoKey> {
  return asCryptoKey(
    await subtle().generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]),
  );
}

/** Encrypt `data` under an item key with a fresh random 12-byte IV. */
export async function encryptItem(
  itemKey: CryptoKey,
  data: ArrayBuffer,
): Promise<EncryptedItem> {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv },
    itemKey,
    data,
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt an item previously produced by {@link encryptItem}.
 * Rejects (throws) when the ciphertext or IV has been tampered with —
 * AES-GCM authentication failure.
 */
export async function decryptItem(
  itemKey: CryptoKey,
  item: EncryptedItem,
): Promise<ArrayBuffer> {
  const iv = base64ToBytes(item.iv);
  const ciphertext = base64ToArrayBuffer(item.ciphertext);
  return subtle().decrypt({ name: "AES-GCM", iv }, itemKey, ciphertext);
}

/**
 * Wrap an item key under a ring key using AES-KW.
 * Returns base64 of the wrapped key bytes.
 */
export async function wrapItemKey(
  itemKey: CryptoKey,
  ringKey: CryptoKey,
): Promise<string> {
  const wrapped = await subtle().wrapKey("raw", itemKey, ringKey, "AES-KW");
  return arrayBufferToBase64(wrapped);
}

/**
 * Unwrap an item key previously produced by {@link wrapItemKey}.
 * A wrong ring key throws: AES-KW's integrity check is the ring-boundary
 * guarantee — there is no silent cross-ring access.
 */
export async function unwrapItemKey(
  wrappedB64: string,
  ringKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = base64ToArrayBuffer(wrappedB64);
  return subtle().unwrapKey(
    "raw",
    wrapped,
    ringKey,
    "AES-KW",
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** SHA-256 of `data`, as a lowercase hex string. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await subtle().digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

// Re-exported codec helpers are also handy to callers storing wrapped keys.
export const base64 = {
  bytesToBase64,
  base64ToBytes,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} as const;
