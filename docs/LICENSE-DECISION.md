# Licence Decision Note — Omega Platform Repository

**Prepared for: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico**
**Status: DECISION PENDING — this note decides nothing. No LICENSE file is
created in this phase, and no repository is created or published in this
phase. The decision is David's alone.**

## 1. Context — the three facts that frame the choice

1. **No git repository exists yet.** The monorepo in this tree is the
   submission-scoped tree for the Meta Global AI Developer Hackathon 2026
   (submissions due November 4, 2026, 9:00 PM ET, via the Cerebral Valley
   portal). At submission, judges will need a repository link — so a repo
   will be created, and a licence choice will attach to it, between now
   and then.
2. **The hackathon rules already take a licence of their own.** Per the
   verified rules summary in `HACKATHON.md` §7, the organizers receive a
   **perpetual, irrevocable, royalty-free licence over all submitted
   material**, with **zero confidentiality**. That licence is granted by
   entering — it applies to whatever is submitted regardless of which
   repo licence is chosen below, and no choice in this note can undo or
   narrow it. Submit OUTPUT only; internal strategy and records live
   outside this tree for exactly this reason.
3. **A public repo is public forever.** If the repo is published publicly,
   anyone can read, clone, and retain the code permanently — mirrors and
   archives outlive any later deletion. The repo licence is what governs
   what all of those non-organizer readers may legally *do* with the code
   (use it, modify it, redistribute it, build a business on it). That —
   not visibility — is the asset decision.

Two further givens:

- The verified rules summary requires the submission to be the
  participant's own original work, and permits open-source components
  where their licences are followed. **No OSI-approved-licence
  requirement for the project's own code appears in that summary.**
  Judges need access to read, run, and evaluate the code; nothing in the
  rules summary says they need ownership-style rights in it.
- This choice covers **Omega's original code only**. Third-party
  open-source components in the tree (frameworks, libraries, the Foundry
  `forge-std` test library, and similar) remain under their own licences
  with their notices intact, whichever option is chosen.

## 2. The options

### (a) MIT

The MIT licence grants anyone who obtains the code the right to use, copy,
modify, merge, publish, distribute, sublicense, and sell it, with only a
copyright/licence notice to preserve. It cannot be revoked for copies
already obtained.

- **For a founder protecting a platform asset:** the weakest protection of
  the four. The day the repo goes public, any competitor may legally fork
  Omega and commercialize the fork, including behind closed doors. The
  LLC keeps copyright but loses exclusivity — the asset becomes a
  commons with attribution.
- **Effect on judging:** maximum openness goodwill. MIT is the licence
  judges and engineers expect by default; it reads as confidence and
  costs the entry nothing in friction.
- **Effect on post-hackathon commercialization:** the company can still
  sell the product, hosting, support, and future (unreleased) code — but
  it can never again sell *exclusivity* in the released code, and any
  investor diligence will price the code as non-exclusive.

### (b) Apache-2.0

Functionally similar to MIT (use, modify, distribute, commercialize), with
two additions: an express patent licence from contributors, and a patent-
retaliation clause (sue for patent infringement over the work and your
licence terminates). Also irrevocable for obtained copies.

- **For a founder:** the same loss of exclusivity as MIT, plus a patent
  grant the company may not want to make over a platform it intends to
  build a business (and possibly a patent position) on. The retaliation
  clause protects the commons, not the founder.
- **Effect on judging:** the same openness goodwill as MIT, with a
  slightly more "enterprise-serious" signal. No practical judging
  downside versus MIT.
- **Effect on commercialization:** same as MIT, with the added wrinkle
  that the patent licence is explicit and permanent for the released
  code — relevant if Quantum Concepts LLC ever intends to assert patents
  covering this platform.

### (c) Proprietary / all-rights-reserved, with a hackathon-review grant

The repo carries a copyright notice (© Quantum Concepts LLC, all rights
reserved) plus a narrow written grant: the code may be read, cloned, and
run **for the purpose of evaluating this hackathon submission** (by the
organizers and judges — noting the organizers already hold their own
licence under the rules), with no right to redistribute, modify for
distribution, or use the code commercially.

- **For a founder:** the strongest preservation of the asset. Copyright,
  exclusivity, and every future licensing option remain with Quantum
  Concepts LLC. The code's *ideas* were always going to be visible once
  submitted (fact 2 above); what stays protected is the implementation as
  a commercial asset.
- **Effect on judging:** the honest cost is openness goodwill — a
  reviewer who defaults to "open = trustworthy" may read all-rights-
  reserved as guarded. This is mitigated if the review grant is real and
  usable (repo readable and runnable for judging with no NDA, no request
  flow, no friction), and if the submission text states the position
  plainly rather than hiding it. Nothing in the verified rules summary
  penalizes it.
- **Effect on commercialization:** fully preserved. Post-hackathon the
  company can commercialize the platform, dual-licence it, open-source
  part or all of it later on its own terms, or keep it closed — every
  door stays open, including the door to choosing (a), (b), or (d) later
  for a later version. (The reverse is not true: (a)/(b) grants, once
  made on a public copy, cannot be recalled.)

### (d) Source-available custom (BUSL / PolyForm-style)

Source-available licences (e.g. Business Source License 1.1, PolyForm
Noncommercial / Small Business) make the source readable while reserving
commercial use — BUSL typically converts each release to an open licence
after a set change date (commonly up to four years); PolyForm variants
permit defined noncommercial or small-business use and forbid the rest.

- **For a founder:** meaningful commercial protection with a friendlier
  public posture than (c) — readers can study and (within the terms) use
  the code non-commercially. In exchange: licence drafting/review cost,
  edge-case ambiguity (what counts as a competing or commercial use of a
  *platform*?), and, for BUSL, a built-in expiry after which the released
  code becomes open anyway.
- **Effect on judging:** mixed. It signals "serious company, deliberately
  chosen terms," but unfamiliar licences create judge friction — a
  reviewer on a deadline may not parse custom terms and may discount the
  repo rather than work out whether they may use it. It is also not
  open source, and must never be described as such.
- **Effect on commercialization:** good, with an asterisk: the company
  keeps commercial exclusivity during the restricted period, but must
  police the licence's boundary cases itself, and (BUSL) the conversion
  date eventually opens each release whether the business is ready or
  not.

## 3. Recommendation

**Recommended: (c) — proprietary / all-rights-reserved, with an explicit
hackathon-review grant.**

Reasoning, plainly:

1. **The submission's exposure is already fixed by the rules.** The
   organizers' perpetual licence (fact 2) exists under every option. The
   only question the repo licence actually decides is what *everyone
   else* — competitors, cloners, future acquirers of a fork — may do.
   Options (a) and (b) answer that question by giving the platform away,
   permanently and irrevocably, on the one week the code is most visible.
2. **Judge access does not require judge ownership.** The review grant in
   (c) gives organizers and judges everything judging needs — read it,
   clone it, run it, verify the claims against the tree — which is the
   same practical access (a)/(b) provide for evaluation purposes. What
   it withholds is only the right to build on the asset commercially,
   which no judging criterion in the verified summary rewards or
   requires.
3. **(c) is the only option that keeps every future open.** Quantum
   Concepts LLC can later open-source the platform, dual-licence it, or
   adopt BUSL-style terms from a position of ownership, at a time of its
   choosing, for business reasons. MIT/Apache cannot be un-chosen for
   copies already public; BUSL starts a conversion clock the company may
   not want. For a founder whose platform *is* the company asset, buying
   optionality here costs only some openness goodwill — and that cost is
   real but modest, and is reduced by making the review grant genuinely
   frictionless and by stating the licence position openly in the
   submission (as `HACKATHON.md` §7 already models with its licence
   warning).
4. **Why not (d) as the compromise:** it preserves most of the asset, but
   it spends drafting cost and judge goodwill on custom terms to protect
   against a risk (noncommercial reuse) that is not the risk that
   matters, while adding boundary ambiguity a two-person evaluation
   window doesn't need. If David later wants a public, readable repo
   with community goodwill *and* commercial protection, (d) is the
   natural second step — chosen deliberately then, not under deadline
   now.

**What (c) does not do — stated so the decision is informed:** it does
not limit the organizers' rules-granted licence in any way; it does not
make the submitted ideas confidential (nothing can — fact 2); and it
does not substitute for the other protections the project already treats
separately (contracts remain unaudited and testnet-grade regardless of
licence; attribution remains David Charles Bourassa under ADR-0004).

## 4. Next steps — only after David decides

1. David picks an option (or directs a variant).
2. A later, separate step drafts the corresponding `LICENSE` file (and,
   for (c), the review-grant text) for David's approval, and adds it to
   the repo when the repo is created.
3. Until then: **no LICENSE file exists in this tree, and that absence
   is deliberate** — an unlicensed public repo defaults to
   all-rights-reserved in effect, but the explicit notice + grant in (c)
   is clearer for judges than silence, which is one more reason to make
   this decision before the repo link is due, not after.

---

*Decision owner: David Charles Bourassa, Founder, Quantum Concepts LLC,
Santa Fe, New Mexico. This note is a recommendation only.*
