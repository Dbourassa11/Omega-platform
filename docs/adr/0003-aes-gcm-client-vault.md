# ADR 0003 — AES-GCM Client Vault Standard

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

## Status

Accepted — 2026-10-22

## Context

The Omega Platform is local-first in the browser: a person's own items (memories, posts, mirror material) live in a client-side encrypted vault, gated by the Consent Ring Mesh, before any sync or export is even considered.

Two encryption approaches existed:

- **M0 server code** used **XChaCha20-Poly1305** for server-side encryption. That choice is reasonable on a server, where a vetted library is available.
- **The browser client** has native, hardware-backed cryptography through **WebCrypto**, whose authenticated encryption primitive is **AES-GCM**. Using XChaCha20 in the browser would require shipping and trusting a JavaScript/WASM implementation instead of the platform's native crypto.

The client vault and the M0 server are different environments with different native primitives; forcing one algorithm across both would weaken the client story. The Implementation Plan resolved the client standard explicitly.

> Honest framing: this ADR specifies the standard for a scaffold. The vault envelope format is not yet fully specified (see Consequences), and no production vault holding real user data exists.

## Decision

**The client vault standard is AES-GCM, per item, with keys wrapped per consent ring, stored in IndexedDB.**

- **Per-item encryption:** Each item is encrypted individually with AES-GCM (WebCrypto `AES-GCM`), with a unique IV per item. Compromise or deletion of one item does not expose others.
- **Per-ring key wrapping:** Item keys are wrapped (encrypted) under keys associated with the item's consent ring(s) (Family / Friends / Work / Public + custom). Granting or revoking a ring is a key-wrapping operation; it never requires re-encrypting the underlying item for other rings, and a ring without a wrapped key cannot decrypt the item.
- **Storage:** Ciphertext, IVs, and wrapped keys are stored in **IndexedDB**. Plaintext items are never persisted.
- **Consent first:** Decryption happens only after a Consent Ring Mesh check passes (see ARCHITECTURE.md invariants). The vault does not decrypt on request alone.
- **XChaCha20-Poly1305 remains only in M0 server code.** It is not the client standard, is not ported into the monorepo client, and its presence in M0 does not create a second client option.

## Consequences

**Positive:**

- **WebCrypto-native:** The client vault uses the browser's native, audited crypto implementation — no third-party cipher implementation in the trust path.
- Per-item + per-ring structure maps directly onto the Consent Ring Mesh: access control and cryptography enforce the same boundary, and revocation has a concrete cryptographic meaning.
- IndexedDB storage keeps the platform local-first: a person's vault exists on their device under their keys, with sync/export as separate, consent-gated steps.

**Costs / open items:**

- **Envelope format to be specified before M1 exit.** The exact vault envelope (field layout, versioning, wrapped-key encoding, metadata binding / AAD) must be written down as a spec and reviewed before the M1 milestone exits. Until then, vault code is scaffold-grade.
- **Key recovery is an open research item.** Per-ring wrapped keys raise hard questions — device loss, key backup, inheritance / legacy access under the Digital Mirror System — that have no accepted answer yet. No recovery mechanism is claimed by this ADR; any future mechanism requires its own ADR and a consent review.
- AES-GCM IV discipline is safety-critical: IV reuse under the same key is catastrophic. Implementations must generate IVs via WebCrypto and be tested for uniqueness handling.
- Server-side encryption (if a future service needs it) is out of scope for this ADR; M0's XChaCha20-Poly1305 choice stays where it is unless a future ADR revisits it.
