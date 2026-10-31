# ADR 0004 — Attribution Name

**Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**

## Status

Accepted — 2026-10-22

## Context

The creator's name has been repeatedly reversed in source drafts:

- The v9 landing page footer carried the reversed form.
- The v9 blueprint (§19) carried the reversed form in its attribution / preferences material.
- The Implementation Plan draft's preferences section carried the reversed form.

In each case the reversed form — "Charles David Bourassa" — is an **error**. The creator's name is David Charles Bourassa: David (first), Charles (middle), Bourassa (family). Drafts generated from other drafts propagated the error, which is exactly how an incorrect attribution becomes entrenched in metadata, credits, and contracts if it is not stopped at the source.

Correct attribution matters beyond courtesy: it appears in book and film credits, ebook metadata, contract notices, and platform accounts, where a reversed name creates real legal and discoverability confusion.

## Decision

**Creator attribution is "David Charles Bourassa" in all code, docs, metadata, and credits.**

- Full attribution line, where a full line is used: **David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**.
- This applies to: source code headers and package metadata, documentation (including this docs tree), smart contract comments and metadata, ebook / book metadata and credits, film credits, cover art, and any generated artifact.
- The reversed form must **never** be used as attribution anywhere, and must never be copied forward from an older draft.

## Consequences

- **Grep-level check in review:** Reviewers check new and edited material for the reversed form (a plain text search for the reversed string). Any hit outside an explicit discussion of the error itself (such as this ADR's Context) is a defect.
- **Correction on intake:** Any new document, draft, or asset that arrives using the reversed form gets corrected on intake, before it is built on — the correction is not deferred and the error is not propagated "for now."
- Existing staged material known to carry the error is corrected at its source file when it is next touched, and is not quoted as an attribution source until it is.
- This ADR is the reference when there is any doubt: if a draft and this ADR disagree about the name order, this ADR — and the creator — win.
