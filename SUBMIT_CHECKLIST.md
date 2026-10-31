# Omega Platform — Submission Session Checklist

**Event:** Meta Global AI Developer Hackathon 2026 (Meta + Cerebral Valley)
**Deadline: November 4, 2026, 9:00 PM ET** — via the Cerebral Valley portal.
**Readiness target:** this package complete and verified **by November 2**, so
the final session is mechanical: repo → push → portal → David's tap.
**Submission scope:** this monorepo ONLY. No planning documents, no internal
records, nothing outside this tree is ever pasted or uploaded.
**Verified state of this tree:** see `docs/FINAL_STATE.md` (543 vitest tests ·
20 routes · forge 9/9 · full turbo gate green · claims sweep clean).

---

## Step 1 — David creates the repository (his step, ~1 minute)

1. Go to **github.com/new** (signed in as the account that will own the project).
2. Repository name, exactly: **`omega-platform`**
3. Visibility: **Public**.
4. **Do NOT** check "Add a README file". **Do NOT** add a `.gitignore` or a
   licence template — the repo must be **completely empty** (the tree already
   carries its own README and its own `LICENSE`).
5. Click **Create repository**.
6. Say **"created"** in chat. That word is the starting gun for Step 2.

## Step 2 — Q-Bit pushes and verifies (no David action needed)

1. `git init` inside the monorepo; confirm the swept tree is what gets staged
   (no `node_modules`, no `.next`, no `.turbo`, no secrets, no internal files).
2. Push to the empty `omega-platform` repo from Step 1.
3. Verify the pushed tree, file by file against `docs/FINAL_STATE.md`:
   - File count matches the fingerprint.
   - `LICENSE` is present at the repo root.
   - `README.md`, `SUBMISSION.md`, `HACKATHON.md`, `docs/FINAL_STATE.md` present.
   - Claims sweep on the pushed tree: clean (no unqualified "world's first",
     no funding-status assertion, no secrets, attribution exactly
     "David Charles Bourassa" everywhere).
4. Report the repo URL back to David. That URL is the only field in Step 3
   that cannot be pre-written.

## Step 3 — Portal submission (Cerebral Valley portal → hackathon → submit)

Fill the fields with this copy, verbatim where quoted:

| Field | Value |
|---|---|
| **Project name** | Omega Platform — Eternal Quantum Horizons Ω |
| **Track** | Startup |
| **Representative / team** | David Charles Bourassa, Founder — Quantum Concepts LLC, Santa Fe, New Mexico |
| **Themes** | "Build for Your World" (primary) · "Push the Frontier" (secondary) |
| **Repository URL** | *(the URL from Step 2 — the only non-pre-written field)* |
| **Demo video** | Upload `docs/demo-video/final-demo.mp4` from this tree (silent, captioned — see its README in `docs/demo-video/`) |
| **Full write-up** | Paste `SUBMISSION.md` where the portal asks for the long description / project details |

**One-liner / tagline field:**

> Your Facebook graph, as a living, consent-bound cosmos you actually own — designed as an overlay for Facebook, built on Meta's own AI stack, owned by you.

**Short description field:**

> Omega is a consent-bound overlay for Facebook: your existing social graph rendered as a navigable 3D cosmos, wrapped in consent rings you control (Family / Friends / Work / Public), backed by a member-keyed encrypted vault, and served by a personal AI that may only see what the active ring allows — and cites or stays silent. A universal policy engine generalizes the rings across ten data domains with deny-by-default evaluation; an agent layer proposes and never self-authorizes — every agent action runs only under a human-approved plan, inside a purpose-limited pass, with a receipt. Design intent only: Omega is an independent project; nothing implies Meta endorsement, partnership, or approval.

**"What to try in the demo" field:**

> 1. **Cosmos (`/cosmos`)** — switch rings (Public → Family) and watch the universe re-light: what changed is what the AI may see. Try Universe and Multiverse views; import the synthetic Facebook export (`/import`) and watch 28 people placed into rings by rule — deny-by-default last.
> 2. **Guided Demo (`/demo`)** — the two-minute story as clickable steps: an Oracle answer with cited sources, then the Guardian's visible refusal when the ring doesn't allow it.
> 3. **Five-Viewer Demonstration (`/privacy/demo`)** — one member's world rendered five authorized ways (Doctor, Family, Friend, Coworker, Public) by the policy engine itself; then revoke access and watch the next evaluation deny.
> 4. **The critical demonstration (`/review/demo`)** — one goal ("Omni, create a sustainable technology community…") becomes a 10-step plan; approve it, execute it, and read the receipts — every step ran under a purpose-limited pass that expired when the run completed. The community it built is at `/communities`.
> 5. **Eternal Garden (`/garden`)** — ask the Legacy Mirror a question the archive supports (it answers with a citation) and one it doesn't (it abstains — it never invents a memory).
> 6. **Public Platform (`/public`)** — the disclosure-filtered public shell: the only payload the public ever sees, rendered as visible JSON and enforced by an allowlist sanitizer in code.

**Honesty notes field (paste as-is if the portal asks about limitations):**

> No live Meta integration is claimed yet: the Meta Model API adapter (Muse Spark 1.3 default, 1.1 fallback) activates with zero code changes when the participant API key lands, and every AI surface is visibly badged as an offline fallback until then. All demo data is synthetic and labeled in-product. The Facebook overlay is design intent, implemented against the member's own data (exports parsed locally in the browser; nothing is uploaded). Contracts are unaudited and testnet-grade, labeled as such everywhere. Scaffold components (the `ui` package, MemberPool / TreasuryRegistry, `apps/docs`, `apps/worker`) are labeled scaffold. The repository licence is proprietary / all-rights-reserved with an explicit hackathon-review grant (see `LICENSE` in the repo).

## Step 4 — David reviews and submits (his tap, final)

1. Q-Bit walks David through the filled portal form, field by field.
2. David confirms: project name, track (Startup), themes, repo URL resolves
   and shows `LICENSE` at the root, video plays, write-up pasted from
   `SUBMISSION.md`.
3. **David taps Submit.** Nobody else submits; nothing is submitted before
   this tap.
4. After submission: save the portal confirmation (screenshot / confirmation
   text) into the project records the same day. Judging runs Nov 4–8; live
   finals Nov 9.

---

*Prepared by Q-Bit for David Charles Bourassa · Quantum Concepts LLC.
Field copy is drawn from `SUBMISSION.md` (the canonical portal write-up);
if the two ever disagree, `SUBMISSION.md` wins and this checklist gets fixed.*
