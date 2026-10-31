// Creative project store for the Omega Platform Creative Suites.
// Local-only persistence (localStorage) — demo data, nothing leaves the browser.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.

export type CreativeSuite = "art" | "music" | "video" | "write";

export interface CreativeProject {
  id: string;
  suite: CreativeSuite;
  title: string;
  body: string;
  updatedAt: string;
}

export const CREATIVE_SUITES: readonly CreativeSuite[] = [
  "art",
  "music",
  "video",
  "write",
] as const;

const STORAGE_KEY = "omega.projects.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readStore(): CreativeProject[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CreativeProject =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CreativeProject).id === "string" &&
        typeof (item as CreativeProject).title === "string" &&
        typeof (item as CreativeProject).body === "string" &&
        typeof (item as CreativeProject).updatedAt === "string" &&
        CREATIVE_SUITES.includes((item as CreativeProject).suite),
    );
  } catch {
    return [];
  }
}

function writeStore(projects: CreativeProject[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Storage full or unavailable (private mode) — the demo keeps working
    // in-memory for the session; nothing else to do.
  }
}

function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `proj-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000_000,
  ).toString(36)}`;
}

const SEED_PROJECTS: readonly CreativeProject[] = [
  {
    id: "seed-art-1",
    suite: "art",
    title: "Nebula Study Ω-1",
    body: "Demo seed project. A gold-on-deep-space study of the Omega nebula: layered gas clouds around a phi-spiral core, silhouettes only, no faces. Draft notes for David Charles Bourassa to shape into the final piece.",
    updatedAt: "2026-10-24T15:00:00.000Z",
  },
  {
    id: "seed-art-2",
    suite: "art",
    title: "Consent Ring Glyphs — Sketch Set",
    body: "Demo seed project. Four glyph studies, one per consent ring (family, friends, work, public), drawn as concentric broken circles in gold leaf on black.",
    updatedAt: "2026-10-23T15:00:00.000Z",
  },
  {
    id: "seed-music-1",
    suite: "music",
    title: "Phi Etude in 61.8",
    body: "Demo seed project. A short etude built on phi proportions: phrases of 61.8 seconds, harmonic ascent motif, space for a human vocal pass. Draft only — persona credit applies at release, never the author's real name in public music metadata.",
    updatedAt: "2026-10-24T16:30:00.000Z",
  },
  {
    id: "seed-music-2",
    suite: "music",
    title: "Harmonic Bed — Cosmos Underscore",
    body: "Demo seed project. A slow harmonic bed for cosmos flythrough scenes: sine-rich pads, gentle pulse at resting heart rate, no drums in the first minute.",
    updatedAt: "2026-10-22T16:30:00.000Z",
  },
  {
    id: "seed-video-1",
    suite: "video",
    title: "Cosmos Flythrough — Cut 1",
    body: "Demo seed project. Opening cut: slow push through the public ring shell toward the trust beacon, ring labels fading in as the camera passes each shell. Rough cut for review, nothing published.",
    updatedAt: "2026-10-25T09:15:00.000Z",
  },
  {
    id: "seed-write-1",
    suite: "write",
    title: "Letter to the Cosmos",
    body: "Demo seed project. Opening draft: 'We built rings not to keep the world out, but to let trust travel at the speed of consent…' — a letter on ring-scoped sharing, to be shaped and finished by its author.",
    updatedAt: "2026-10-25T10:00:00.000Z",
  },
  {
    id: "seed-write-2",
    suite: "write",
    title: "Notes Toward an Enfolded Cosmos",
    body: "Demo seed project. Working notes connecting the consent rings to the enfolded-cosmos essays: what is shared, with whom, and under which ring — never by default.",
    updatedAt: "2026-10-21T10:00:00.000Z",
  },
];

/**
 * Seed the clearly-demo projects on first run. No-op when a store already
 * exists (even an empty one the user deliberately cleared down) or off-browser.
 * Returns the current project list.
 */
export function seedProjects(): CreativeProject[] {
  if (!isBrowser()) return [];
  const existing = readStore();
  if (existing !== null) return existing;
  const seeded = [...SEED_PROJECTS];
  writeStore(seeded);
  return seeded;
}

/** List projects, optionally filtered to one suite, newest first. */
export function listProjects(suite?: CreativeSuite): CreativeProject[] {
  const all = seedProjects();
  const filtered =
    suite === undefined ? all : all.filter((p) => p.suite === suite);
  return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Create or update a project. Pass an existing `id` to update it in place;
 * omit `id` to create a new project. Returns the saved project.
 */
export function saveProject(input: {
  id?: string;
  suite: CreativeSuite;
  title: string;
  body: string;
}): CreativeProject {
  const all = seedProjects();
  const now = new Date().toISOString();
  const existing =
    input.id !== undefined
      ? all.find((p) => p.id === input.id)
      : undefined;

  if (existing !== undefined) {
    const updated: CreativeProject = {
      ...existing,
      suite: input.suite,
      title: input.title,
      body: input.body,
      updatedAt: now,
    };
    writeStore(all.map((p) => (p.id === updated.id ? updated : p)));
    return updated;
  }

  const created: CreativeProject = {
    id: input.id ?? newId(),
    suite: input.suite,
    title: input.title,
    body: input.body,
    updatedAt: now,
  };
  writeStore([created, ...all]);
  return created;
}

/** Delete a project by id. Returns true when a project was removed. */
export function deleteProject(id: string): boolean {
  const all = seedProjects();
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
  writeStore(next);
  return true;
}
