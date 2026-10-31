/// <reference lib="dom" />
/**
 * @omega/vault-core — chunk-safe base64 codec.
 * Creator: David Charles Bourassa
 *
 * Works in browsers and Node 20+ (both provide global btoa/atob).
 * No Buffer-only APIs. Encoding builds the binary string in chunks so
 * large payloads never blow the argument-spread / call-stack limits.
 */

const CHUNK_SIZE = 0x8000; // 32 KiB

/** Encode bytes to a standard base64 string, chunk-safe for large arrays. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

/** Decode a standard base64 string to bytes, chunk-safe for large inputs. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, binary.length);
    for (let j = i; j < end; j += 1) {
      bytes[j] = binary.charCodeAt(j);
    }
  }
  return bytes;
}

/** Encode an ArrayBuffer to base64. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

/** Decode base64 to a fresh ArrayBuffer (exact length, no slack bytes). */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = base64ToBytes(base64);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
