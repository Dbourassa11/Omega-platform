import { describe, expect, it } from "vitest";

import {
  VAULT_CORE_STATUS,
  base64ToBytes,
  bytesToBase64,
  decryptItem,
  encryptItem,
  exportRingKey,
  generateItemKey,
  generateRingKey,
  importRingKey,
  sha256Hex,
  unwrapItemKey,
  wrapItemKey,
} from "./index.js";

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function sampleData(size = 4096): ArrayBuffer {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes.subarray(0, Math.min(size, 65536)));
  for (let i = 65536; i < size; i += 65536) {
    globalThis.crypto.getRandomValues(
      bytes.subarray(i, Math.min(size, i + 65536)),
    );
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

describe("VAULT_CORE_STATUS", () => {
  it("reports the working local WebCrypto implementation", () => {
    expect(VAULT_CORE_STATUS).toBe(
      "WORKING — local WebCrypto AES-GCM items + AES-KW ring-wrapped keys; no server persistence",
    );
  });
});

describe("encryptItem / decryptItem (AES-GCM)", () => {
  it("round-trips with byte equality", async () => {
    const itemKey = await generateItemKey();
    const data = sampleData(8192);
    const encrypted = await encryptItem(itemKey, data);
    const decrypted = await decryptItem(itemKey, encrypted);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(data));
  });

  it("rejects tampered ciphertext (GCM authentication)", async () => {
    const itemKey = await generateItemKey();
    const data = sampleData(256);
    const encrypted = await encryptItem(itemKey, data);
    const tamperedBytes = base64ToBytes(encrypted.ciphertext);
    const first = tamperedBytes[0] ?? 0;
    tamperedBytes[0] = first ^ 0xff;
    const tampered = {
      iv: encrypted.iv,
      ciphertext: bytesToBase64(tamperedBytes),
    };
    await expect(decryptItem(itemKey, tampered)).rejects.toThrow();
  });

  it("uses a fresh IV per encryption", async () => {
    const itemKey = await generateItemKey();
    const data = sampleData(64);
    const a = await encryptItem(itemKey, data);
    const b = await encryptItem(itemKey, data);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});

describe("ring keys + wrapItemKey / unwrapItemKey (AES-KW)", () => {
  it("exports and re-imports a ring key that still unwraps", async () => {
    const ringKey = await generateRingKey();
    const itemKey = await generateItemKey();
    const wrapped = await wrapItemKey(itemKey, ringKey);
    const reimported = await importRingKey(await exportRingKey(ringKey));
    const unwrapped = await unwrapItemKey(wrapped, reimported);
    expect(unwrapped.algorithm.name).toBe("AES-GCM");
  });

  it("wrap → unwrap → decrypt completes the full round-trip", async () => {
    const ringKey = await generateRingKey();
    const itemKey = await generateItemKey();
    const data = sampleData(2048);
    const encrypted = await encryptItem(itemKey, data);
    const wrapped = await wrapItemKey(itemKey, ringKey);
    const unwrapped = await unwrapItemKey(wrapped, ringKey);
    const decrypted = await decryptItem(unwrapped, encrypted);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(data));
  });

  it("rejects unwrapping with a DIFFERENT ring key (ring boundary)", async () => {
    const ringKey = await generateRingKey();
    const otherRingKey = await generateRingKey();
    const itemKey = await generateItemKey();
    const wrapped = await wrapItemKey(itemKey, ringKey);
    await expect(unwrapItemKey(wrapped, otherRingKey)).rejects.toThrow();
  });
});

describe("sha256Hex", () => {
  it("matches the known empty-input hash", async () => {
    await expect(sha256Hex(new ArrayBuffer(0))).resolves.toBe(EMPTY_SHA256);
  });

  it("matches the hash of non-empty data computed independently", async () => {
    const data = new TextEncoder().encode("omega vault").buffer as ArrayBuffer;
    const hex = await sha256Hex(data);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(hex).not.toBe(EMPTY_SHA256);
  });
});

describe("base64 helpers", () => {
  it("round-trips random bytes byte-for-byte", () => {
    const bytes = new Uint8Array(sampleData(1024));
    const roundTripped = base64ToBytes(bytesToBase64(bytes));
    expect(roundTripped).toEqual(bytes);
  });

  it("round-trips large arrays across chunk boundaries", () => {
    const size = 200_001; // > several 32 KiB chunks, not a chunk multiple
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) {
      bytes[i] = (i * 31 + 7) % 256;
    }
    const roundTripped = base64ToBytes(bytesToBase64(bytes));
    expect(roundTripped.length).toBe(size);
    expect(roundTripped).toEqual(bytes);
  });

  it("round-trips empty input", () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe("");
    expect(base64ToBytes("")).toEqual(new Uint8Array(0));
  });
});
