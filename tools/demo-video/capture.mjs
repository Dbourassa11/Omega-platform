#!/usr/bin/env node
/**
 * Demo-video capture — walks the §6 demo beats in a headless Chromium
 * (software rendering: SwiftShader) against a running production build
 * of @omega/web and saves one frame per beat for assemble.mjs.
 *
 * The capture drives the REAL UI: it sets the demo node-count select
 * to 2,000, clicks a cosmos node, switches Public → Family, then on
 * the Oracle page asks an in-ring question and the cross-ring
 * (Guardian) question via the page's own suggestion chips.
 *
 * Software rendering means these frames are for STRUCTURE only.
 * No performance / FPS figure may be derived from them.
 *
 * Puppeteer is intentionally NOT a monorepo dependency. Set it up once:
 *   mkdir -p /tmp/shot && cd /tmp/shot && npm init -y && npm i puppeteer
 * (downloads Chromium). This script resolves puppeteer from
 * /tmp/shot/node_modules.
 *
 * Usage: node capture.mjs [--base http://127.0.0.1:3217] [--out ./frames]
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
const BASE = arg("base", "http://127.0.0.1:3217");
const OUT = path.resolve(arg("out", path.join(process.cwd(), "frames")));

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

async function shot(page, beat, title, caption, file) {
  const p = path.join(OUT, file);
  await page.screenshot({ path: p });
  frames.push({ beat, title, caption, file });
  console.log(`captured beat ${beat}: ${file}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  /* ---- Beats 1–3: the guided demo's live cosmos embed ---- */
  await page.goto(`${BASE}/demo`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector(".cosmos-stage canvas", { timeout: 60_000 });
  await sleep(4000); // let the intro sweep settle (structure capture)

  // Beat 1 — hook: presenter action, done for real: nodes → 2,000.
  const selects = await page.$$("select");
  if (selects.length > 0) await selects[0].select("2000");
  await sleep(2500);
  await shot(page, 1, "Hook — your graph, as a cosmos",
    "Your Facebook graph, as a living cosmos you actually own. (2,000 nodes)",
    "beat1-hook.png");

  // Beat 2 — fly-to: advance the guide, click into the canvas.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Next beat"))?.click();
  });
  await sleep(600);
  const box = await page.$eval(".cosmos-stage", (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  // Click a few plausible node positions; selection (if any) is a bonus,
  // the frame is structural either way.
  for (const [fx, fy] of [[0.42, 0.45], [0.58, 0.55], [0.5, 0.38]]) {
    await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy);
    await sleep(900);
  }
  await sleep(1200);
  await shot(page, 2, "Fly-through — click a node",
    "Click a node: fly-to-node, inspection panel opens.",
    "beat2-flyto.png");

  // Beat 3 — ring switch Public → Family via the real ring buttons.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Next beat"))?.click();
  });
  await sleep(600);
  async function clickRing(label) {
    await page.evaluate((text) => {
      [...document.querySelectorAll(".ring-button")].find((b) => b.textContent?.trim() === text)?.click();
    }, label);
  }
  await clickRing("Public");
  await sleep(1200);
  await clickRing("Family");
  await sleep(1800);
  await shot(page, 3, "The ring switch — Public to Family",
    "The universe re-lights: what changed is what the AI may see.",
    "beat3-rings.png");

  /* ---- Beats 4–5: the Oracle page's own chips ---- */
  await page.goto(`${BASE}/oracle`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector(".oracle-messages", { timeout: 60_000 });
  await sleep(1500);
  // Match the demo's Family ring, then ask in-ring via the suggestion chip.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Family")?.click();
  });
  await sleep(500);
  await page.evaluate(() => {
    [...document.querySelectorAll(".suggestion-row button")]
      .find((b) => b.textContent?.startsWith("Tell me about"))?.click();
  });
  await sleep(3500);
  await shot(page, 4, "Ask the Oracle — in-ring answer",
    "Ring-scoped answer with citations, grounded only in in-ring demo data.",
    "beat4-oracle.png");

  await page.evaluate(() => {
    [...document.querySelectorAll(".suggestion-row button")]
      .find((b) => b.textContent?.includes("Try crossing a ring"))?.click();
  });
  await sleep(3500);
  // Bring the refusal bubble into the viewport for the frame.
  await page.evaluate(() => {
    const bubbles = document.querySelectorAll(".oracle-bubble");
    bubbles[bubbles.length - 1]?.scrollIntoView({ block: "center" });
  });
  await sleep(600);
  await shot(page, 5, "Guardian refusal — the boundary holds",
    "The Guardian refuses, visibly, with the ring boundary named.",
    "beat5-guardian.png");

  /* ---- Beat 6: PhiSplit close (exact split, live page) ---- */
  await page.goto(`${BASE}/phisplit`, { timeout: 90_000, waitUntil: "load" });
  await page.waitForSelector(".split-bar", { timeout: 60_000 });
  await sleep(1500);
  await shot(page, 6, "Close — Trust Beacon & PhiSplit",
    "Trust 61.8033988% / Members 23.6067976% / Operations 14.5898036%",
    "beat6-phisplit.png");
} finally {
  await browser.close();
}

await writeFile(
  path.join(OUT, "manifest.json"),
  JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), frames, consoleErrors }, null, 2),
);
console.log(`manifest: ${frames.length} frames, ${consoleErrors.length} console errors`);
if (frames.length < 6) process.exit(1);
