#!/usr/bin/env node
/**
 * FINAL demo-video capture — walks every section of the submission
 * demo against a running production build of @omega/web and saves one
 * real captured frame per beat for assemble-final.mjs.
 *
 * Every frame is a REAL capture of the production UI, driven with
 * real interactions:
 *   Cosmos      — mode buttons: Consent Cosmos → Universe → Multiverse
 *   Stellar     — back in Consent Cosmos, a member star is clicked so
 *                 the inspector shows its Friends / Followers / Mass /
 *                 Density / Brightness (Phase 4 stellar physics)
 *   Import      — "Load the synthetic sample export" (parsed locally)
 *   Vault       — a real file uploaded through the file input, then
 *                 the real "Decrypt & verify" flow to a hash match
 *   Garden      — the page's own suggestion chips: a supported
 *                 question (cited answer), then an unsupported one
 *                 (the Mirror abstains)
 *   Privacy     — the five viewer tabs Doctor → Family → Friend →
 *                 Coworker → Public on /privacy/demo
 *   Omni        — Generate plan → Approve as the demo member owner →
 *                 Execute on /review/demo, captured at RUN COMPLETED
 *   Communities — reached by CLIENT-SIDE navigation from the Omni
 *                 results (a reload would reset the in-memory run);
 *                 the agent's educational draft is then published to
 *                 the feed with the page's own publish button
 *   Public      — the disclosure-filtered /public shell
 *
 * Captures run under software rendering (SwiftShader): they prove
 * structure only. No performance / FPS figure may be derived from
 * them; in-frame honesty labels (OFFLINE badges, "Synthetic" labels,
 * the overlay design-intent disclaimer) are the product's real state
 * and are never cropped out.
 *
 * Puppeteer is intentionally NOT a monorepo dependency — resolved
 * from /tmp/shot/node_modules, exactly as capture.mjs does.
 *
 * Usage: node capture-final.mjs [--base http://127.0.0.1:3100] [--out ./frames-final]
 * Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const BASE = arg("base", "http://127.0.0.1:3100");
const OUT = path.resolve(arg("out", path.join(process.cwd(), "frames-final")));

let puppeteer;
try {
  puppeteer = createRequire("/tmp/shot/package.json")("puppeteer");
} catch {
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    console.error(
      "puppeteer not found. Run: mkdir -p /tmp/shot && cd /tmp/shot && npm init -y && npm i puppeteer",
    );
    process.exit(2);
  }
}

await mkdir(OUT, { recursive: true });
const frames = [];
const consoleErrors = [];
const notes = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, meta) {
  const p = path.join(OUT, meta.file);
  await page.screenshot({ path: p });
  frames.push(meta);
  console.log(`captured: ${meta.file} [${meta.section}]`);
}

/** Click a <button> whose trimmed text equals `text` (or starts with it). */
async function clickButton(page, text, { exact = true } = {}) {
  const ok = await page.evaluate(
    (t, ex) => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((el) =>
        ex ? el.textContent?.trim() === t : el.textContent?.trim().startsWith(t),
      );
      if (!b) return false;
      b.scrollIntoView({ block: "center" });
      b.click();
      return true;
    },
    text,
    exact,
  );
  if (!ok) throw new Error(`button not found: "${text}"`);
}

async function scrollTextIntoView(page, selector, text) {
  await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((e) =>
        e.textContent?.includes(t),
      );
      el?.scrollIntoView({ block: "start" });
    },
    selector,
    text,
  );
  await sleep(500);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const loc = msg.location();
      consoleErrors.push(loc?.url ? `${msg.text()} [${loc.url}]` : msg.text());
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("response", (res) => {
    if (res.status() >= 400) {
      consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  /* ================= COSMOS — three views ================= */
  await page.goto(`${BASE}/cosmos`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector(".cosmos-stage canvas", { timeout: 60_000 });
  await sleep(4000);
  await page.evaluate(() => {
    document
      .querySelector(".cosmos-stage")
      ?.scrollIntoView({ block: "center" });
  });
  await sleep(600);
  await shot(page, {
    section: "cosmos",
    sectionTitle: "Cosmos — Three Views",
    sectionNarration: "One engine, three views of the same cosmos.",
    caption: "Consent Cosmos — synthetic demo constellation, no real member data",
    file: "cosmos-consent.png",
    hold: 7,
  });
  await clickButton(page, "Universe");
  await sleep(3500);
  await page.evaluate(() => {
    document
      .querySelector(".cosmos-stage")
      ?.scrollIntoView({ block: "center" });
  });
  await sleep(600);
  await shot(page, {
    section: "cosmos",
    caption: "Universe — simulated cosmic web; a statistical model, not a star catalog",
    file: "cosmos-universe.png",
    hold: 7,
  });
  await clickButton(page, "Multiverse");
  await sleep(3500);
  await page.evaluate(() => {
    document
      .querySelector(".cosmos-stage")
      ?.scrollIntoView({ block: "center" });
  });
  await sleep(600);
  await shot(page, {
    section: "cosmos",
    caption: "Multiverse — SPECULATIVE visualization, labeled as such in-product",
    file: "cosmos-multiverse.png",
    hold: 7,
  });

  /* ============ STELLAR PHYSICS (Phase 4 — Alive Pass) ============ */
  // Dedicated fresh page for this frame: reduced-motion is emulated
  // BEFORE first load (the engine honors it at creation, so star
  // positions are stable) and the page navigates directly to the
  // Consent Cosmos — probing in the main capture page, after the
  // Universe/Multiverse view switches, did not land a selection.
  const stellarPage = await browser.newPage();
  await stellarPage.setViewport({ width: 1280, height: 720 });
  stellarPage.on("console", (msg) => {
    if (msg.type() === "error") {
      const loc = msg.location();
      consoleErrors.push(loc?.url ? `${msg.text()} [${loc.url}]` : msg.text());
    }
  });
  stellarPage.on("pageerror", (err) => consoleErrors.push(String(err)));
  stellarPage.on("response", (res) => {
    if (res.status() >= 400) {
      consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });
  await stellarPage.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await stellarPage.goto(`${BASE}/cosmos`, {
    timeout: 90_000,
    waitUntil: "load",
  });
  await stellarPage.waitForSelector(".cosmos-stage canvas", {
    timeout: 60_000,
  });
  await sleep(5000);
  await stellarPage.evaluate(() => {
    document
      .querySelector(".cosmos-stage")
      ?.scrollIntoView({ block: "center" });
  });
  await sleep(600);
  // Click member stars until the inspector shows the stellar readouts
  // (Friends / Followers / Mass / Density / Brightness). Probe an
  // annulus-weighted golden-angle spiral, then the inner disc.
  const stageBox = await stellarPage.evaluate(() => {
    const el = document.querySelector(".cosmos-stage canvas");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  let inspectorFound = false;
  if (stageBox) {
    const probes = [];
    for (let k = 0; k < 40; k++) {
      const a = k * 2.39996;
      const r = 0.3 + 0.19 * ((k * 0.61803) % 1);
      probes.push([0.5 + r * Math.cos(a) * 1.15, 0.5 + r * Math.sin(a)]);
    }
    for (let k = 0; k < 30; k++) {
      const a = k * 2.39996 + 1.1;
      const r = 0.08 + 0.2 * ((k * 0.754877) % 1);
      probes.push([0.5 + r * Math.cos(a) * 1.15, 0.5 + r * Math.sin(a)]);
    }
    for (const [fx, fy] of probes) {
      await stellarPage.mouse.click(
        stageBox.x + stageBox.w * fx,
        stageBox.y + stageBox.h * fy,
      );
      await sleep(320);
      inspectorFound = await stellarPage.evaluate(() =>
        document.body.innerText.includes("Brightness"),
      );
      if (inspectorFound) break;
    }
  }
  notes.push(
    inspectorFound
      ? "stellar: inspector opened on a member star — Mass / Density / Brightness readouts visible"
      : "stellar: no inspector hit while probing; the frame carries the in-page physics legend instead",
  );
  await shot(stellarPage, {
    section: "cosmos-stellar",
    sectionTitle: "Stellar Physics",
    sectionNarration:
      "Friends make a star massive · Followers make it dense and bright",
    caption:
      "Every member is a star — friends set its mass; followers set its density and brightness, computed live in the inspector",
    file: "cosmos-stellar.png",
    hold: 8,
  });
  await stellarPage.close();

  /* ================= IMPORT ARCHIVE ================= */
  await page.goto(`${BASE}/import`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector("button", { timeout: 60_000 });
  await sleep(1000);
  await clickButton(page, "Load the synthetic sample export");
  await page.waitForFunction(
    () => document.body.innerText.includes("Import summary"),
    { timeout: 30_000 },
  );
  await sleep(1000);
  await scrollTextIntoView(page, "h2", "Import summary");
  await shot(page, {
    section: "import",
    sectionTitle: "Import Archive",
    sectionNarration: "Your Facebook export, parsed on your own device.",
    caption:
      "Parsed entirely in the browser; nothing uploaded; deny-by-default into the most restrictive ring",
    file: "import-result.png",
    hold: 8,
  });

  /* ================= VAULT ================= */
  const vaultFile = "/tmp/omega-vault-demo.txt";
  await writeFile(
    vaultFile,
    "Omega demo vault note — synthetic content created for the final demo capture. No real data.\n",
  );
  await page.goto(`${BASE}/vault`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector("#vault-file-input", { timeout: 60_000 });
  await sleep(800);
  const fileInput = await page.$("#vault-file-input");
  await fileInput.uploadFile(vaultFile);
  await page.waitForFunction(
    () => document.body.innerText.includes("omega-vault-demo.txt"),
    { timeout: 30_000 },
  );
  await sleep(1200);
  await scrollTextIntoView(page, "h3", "Vault items");
  await shot(page, {
    section: "vault",
    sectionTitle: "Sovereign Vault",
    sectionNarration: "Real encryption, on-device, ring by ring.",
    caption: "Encrypted locally into the family ring — AES-GCM, the item key wrapped per ring",
    file: "vault-added.png",
    hold: 5,
  });
  await clickButton(page, "Decrypt & verify");
  await page.waitForFunction(
    () => document.body.innerText.includes("Verified ✓ — integrity match"),
    { timeout: 30_000 },
  );
  notes.push("vault: decrypt & verify reached 'Verified ✓ — integrity match'");
  await sleep(800);
  await scrollTextIntoView(page, "h3", "Vault items");
  await shot(page, {
    section: "vault",
    caption: "Decrypt & verify — SHA-256 integrity match",
    file: "vault-verified.png",
    hold: 7,
  });

  /* ================= ETERNAL GARDEN ================= */
  await page.goto(`${BASE}/garden`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector(".suggestion-row button", { timeout: 60_000 });
  await sleep(1500);
  // Supported question, via the page's own suggestion chip.
  await clickButton(page, "Tell me about the lighthouse at Port Anselm");
  await sleep(1500);
  await page.waitForSelector(".legacy-answer", { timeout: 30_000 });
  await page.evaluate(() => {
    document
      .querySelector(".legacy-answer")
      ?.scrollIntoView({ block: "center" });
  });
  await sleep(600);
  const citedText = await page.evaluate(
    () => document.querySelector(".legacy-answer")?.innerText ?? "",
  );
  notes.push(
    `garden cited answer kind-check: ${citedText.slice(0, 120).replace(/\s+/g, " ")}`,
  );
  await shot(page, {
    section: "garden",
    sectionTitle: "Eternal Garden",
    sectionNarration: "The Legacy Mirror answers only from the archive.",
    caption: "Cited from the archive",
    file: "garden-cited.png",
    hold: 8,
  });
  // Unsupported question — the Mirror must abstain.
  await page.evaluate(() => {
    [...document.querySelectorAll(".suggestion-row button")]
      .find((b) => b.textContent?.includes("Antarctica"))
      ?.click();
  });
  await sleep(1500);
  await page.evaluate(() => {
    document
      .querySelector(".legacy-answer")
      ?.scrollIntoView({ block: "center" });
  });
  await sleep(600);
  const abstainText = await page.evaluate(
    () => document.querySelector(".legacy-answer")?.innerText ?? "",
  );
  if (!/abstain/i.test(abstainText)) {
    throw new Error(
      `garden abstention not visible; answer was: ${abstainText.slice(0, 200)}`,
    );
  }
  notes.push("garden: abstention state confirmed in-page before capture");
  await shot(page, {
    section: "garden",
    caption: "No support in the archive — the Mirror abstains. It never invents a memory.",
    file: "garden-abstain.png",
    hold: 8,
  });

  /* ================= PRIVACY — FIVE VIEWERS ================= */
  await page.goto(`${BASE}/privacy/demo`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector(".tabs .tab", { timeout: 60_000 });
  await sleep(1200);
  const viewers = [
    ["Doctor", "privacy-doctor.png"],
    ["Family", "privacy-family.png"],
    ["Friend", "privacy-friend.png"],
    ["Coworker", "privacy-coworker.png"],
    ["Public", "privacy-public.png"],
  ];
  for (const [label, file] of viewers) {
    await clickButton(page, label);
    await sleep(1300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    const meta = {
      section: "privacy",
      caption:
        "One member's world, five authorized views — every decision computed by the policy engine",
      file,
      hold: 4,
    };
    if (label === "Doctor") {
      meta.sectionTitle = "Privacy — Five Viewers";
      meta.sectionNarration = "The same world, re-rendered per viewer.";
    }
    await shot(page, meta);
  }

  /* ================= OMNI DEMONSTRATION ================= */
  await page.goto(`${BASE}/review/demo`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector("button", { timeout: 60_000 });
  await sleep(1200);
  await clickButton(page, "Generate plan");
  await sleep(1800);
  await scrollTextIntoView(page, "h3", "Step 2 — Review the steps");
  await shot(page, {
    section: "omni",
    sectionTitle: "Omni Demonstration",
    sectionNarration: "Agents propose. A person approves. Receipts prove it.",
    caption: "The offline planner proposes a 10-step plan — generating it runs nothing",
    file: "omni-plan.png",
    hold: 6,
  });
  await clickButton(page, "Approve plan as", { exact: false });
  await sleep(1200);
  await clickButton(page, "Execute approved plan");
  // NOTE: the run badge is CSS text-transform:uppercase, so innerText
  // yields "RUN COMPLETED" — match case-insensitively.
  await page.waitForFunction(
    () => /run completed/i.test(document.body.innerText),
    { timeout: 90_000 },
  );
  await sleep(1500);
  const runSummary = await page.evaluate(() => {
    const m = document.body.innerText.match(
      /run completed[\s\S]{0,80}?steps executed/i,
    );
    return m ? m[0].replace(/\s+/g, " ") : "summary pattern not found";
  });
  notes.push(`omni run summary in-page: ${runSummary}`);
  await scrollTextIntoView(page, "h3", "Step 5 — Results");
  await shot(page, {
    section: "omni",
    caption:
      "Agents propose; a person approves; every step runs under a purpose-limited pass and lands a receipt",
    file: "omni-results.png",
    hold: 9,
  });

  /* ============ COMMUNITIES (SPA navigation — state must survive) ============ */
  const navOk = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find(
      (el) => el.getAttribute("href") === "/communities",
    );
    if (!a) return false;
    a.click();
    return true;
  });
  if (!navOk) throw new Error("communities link not found on omni results");
  await page.waitForFunction(
    () =>
      location.pathname === "/communities" &&
      document.body.innerText.includes("Terra Tech Commons"),
    { timeout: 30_000 },
  );
  await sleep(1200);
  await scrollTextIntoView(page, "h2", "Terra Tech Commons");
  await shot(page, {
    section: "communities",
    sectionTitle: "Communities",
    sectionNarration: "What the approved run built.",
    caption: "Terra Tech Commons — created by the approved Omni run, demo-local",
    file: "communities-top.png",
    hold: 4,
  });
  // Publish the agent's educational draft into the feed (real control).
  const published = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (el) => el.textContent?.trim() === "Publish to community feed",
    );
    if (!b) return false;
    b.click();
    return true;
  });
  notes.push(
    published
      ? "communities: educational draft published to the feed via the page's own button"
      : "communities: no publish button found (post may already be in the feed)",
  );
  await sleep(1200);
  await scrollTextIntoView(page, "h3", "Feed");
  await shot(page, {
    section: "communities",
    caption: "The community the run built — inspectable, receipted",
    file: "communities-feed.png",
    hold: 6,
  });

  /* ================= CLOSE — PUBLIC SHELL ================= */
  await page.goto(`${BASE}/public`, { timeout: 90_000, waitUntil: "load" });
  await sleep(1800);
  await shot(page, {
    section: "close",
    sectionTitle: "Close — the Public Shell",
    sectionNarration: "What anyone may see — no account, no receipt.",
    caption: "The disclosure-filtered public shell — allowlist-enforced, nothing personal",
    file: "public-shell.png",
    hold: 7,
  });
} finally {
  await browser.close();
}

await writeFile(
  path.join(OUT, "manifest.json"),
  JSON.stringify(
    {
      base: BASE,
      capturedAt: new Date().toISOString(),
      frames,
      consoleErrors,
      notes,
    },
    null,
    2,
  ),
);
console.log(
  `manifest: ${frames.length} frames, ${consoleErrors.length} console errors`,
);
for (const n of notes) console.log(`note: ${n}`);
if (consoleErrors.length > 0) {
  for (const e of consoleErrors) console.log(`console-error: ${e}`);
}
if (frames.length < 18) process.exit(1);
