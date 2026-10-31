"use client";

// Creative Suites — Art / Music / Video / Write project workspaces with an
// AI prompt composer (Creator Agent via @omega/ai-core). Projects persist
// locally only. Sharing hands a draft to the Share Center (/share); nothing
// is posted anywhere from this page.
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import "@/app/creative/suites.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createChatProvider, getChatProviderStatus } from "@omega/ai-core";
import type { ChatCompletionProvider } from "@omega/ai-core";
import {
  CREATIVE_SUITES,
  deleteProject,
  listProjects,
  saveProject,
} from "@/lib/projects";
import type { CreativeProject, CreativeSuite } from "@/lib/projects";
import { sendToShareCenter } from "@/lib/sharebox";
import type { ShareDraft } from "@/lib/sharebox";
import { logActivity } from "@/lib/activity";

interface SuiteConfig {
  label: string;
  tones: readonly string[];
  lengths: readonly string[];
  composerHint: string;
}

const SUITE_CONFIG: Record<CreativeSuite, SuiteConfig> = {
  art: {
    label: "Art",
    tones: ["Vivid", "Minimal", "Surreal", "Golden-hour"],
    lengths: ["Brief concept", "Detailed brief", "Full treatment"],
    composerHint: "Describe the image, scene, or visual study to draft.",
  },
  music: {
    label: "Music",
    tones: ["Uplifting", "Melancholic", "Anthemic", "Meditative"],
    lengths: ["Hook only", "Verse + chorus", "Full song sketch"],
    composerHint: "Describe the song, motif, or underscore to draft.",
  },
  video: {
    label: "Video",
    tones: ["Cinematic", "Documentary", "Playful", "Epic"],
    lengths: ["15-second spot", "60-second short", "Scene outline"],
    composerHint: "Describe the shot, sequence, or short film to draft.",
  },
  write: {
    label: "Write",
    tones: ["Warm", "Poetic", "Direct", "Formal"],
    lengths: ["Short paragraph", "One page", "Long-form outline"],
    composerHint: "Describe the letter, essay, or passage to draft.",
  },
};

const CREATOR_SYSTEM_PROMPT =
  "You are the Creator Agent for the Omega Platform, working in the " +
  "Creative Suites. Help David Charles Bourassa draft original creative " +
  "work. Preserve human authorship framing: everything you produce is a " +
  "draft for David Charles Bourassa to shape, revise, and finish — never " +
  "present it as a completed work and never claim authorship of it.";

type Backend = "meta-model-api" | "offline-stub";

function BackendBadge({
  backend,
  model,
}: {
  backend: Backend;
  model?: string;
}) {
  if (backend === "meta-model-api") {
    return (
      <span className="badge badge-live">
        Live — Meta Model API{model !== undefined ? ` · ${model}` : ""}
      </span>
    );
  }
  return (
    <span className="badge badge-offline">
      Offline fallback — no API key connected; showing the offline draft
      response
    </span>
  );
}

function ProviderStatusBadge({
  mode,
  model,
}: {
  mode: "live" | "offline";
  model: string;
}) {
  if (mode === "live") {
    return (
      <span className="badge badge-live">Live — Meta Model API · {model}</span>
    );
  }
  return (
    <span className="badge badge-offline">
      Offline fallback — no API key connected
    </span>
  );
}

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CreativePage() {
  const router = useRouter();
  // One provider instance per page load; its status is the same
  // key-presence signal every badge on this page flips from.
  const [provider] = useState<ChatCompletionProvider>(() =>
    createChatProvider(),
  );
  const [providerStatus] = useState(() => getChatProviderStatus(provider));

  const [activeSuite, setActiveSuite] = useState<CreativeSuite>("art");
  const [projects, setProjects] = useState<CreativeProject[]>([]);

  // Inline create / edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");

  // Prompt composer
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<string>(
    SUITE_CONFIG.art.tones[0] ?? "Vivid",
  );
  const [length, setLength] = useState<string>(
    SUITE_CONFIG.art.lengths[0] ?? "Brief concept",
  );
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBackend, setDraftBackend] = useState<Backend | null>(null);
  const [draftModel, setDraftModel] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const config = SUITE_CONFIG[activeSuite];

  function refresh(suite: CreativeSuite) {
    setProjects(listProjects(suite));
  }

  useEffect(() => {
    refresh("art");
  }, []);

  function getProvider(): ChatCompletionProvider {
    return provider;
  }

  function handleSuiteChange(suite: CreativeSuite) {
    const next = SUITE_CONFIG[suite];
    setActiveSuite(suite);
    refresh(suite);
    setFormOpen(false);
    setEditingId(null);
    setFormTitle("");
    setFormBody("");
    setPrompt("");
    setTone(next.tones[0] ?? "");
    setLength(next.lengths[0] ?? "");
    setDraft(null);
    setDraftBackend(null);
    setDraftModel(null);
    setGenerateError(null);
    setDraftSaved(false);
  }

  function openNewForm() {
    setEditingId(null);
    setFormTitle("");
    setFormBody("");
    setFormOpen(true);
  }

  function openEditForm(project: CreativeProject) {
    setEditingId(project.id);
    setFormTitle(project.title);
    setFormBody(project.body);
    setFormOpen(true);
  }

  function handleSaveForm() {
    const title = formTitle.trim() || "Untitled project";
    if (editingId !== null) {
      saveProject({ id: editingId, suite: activeSuite, title, body: formBody });
      logActivity("creative", `Edited project "${title}" in ${config.label}`);
    } else {
      saveProject({ suite: activeSuite, title, body: formBody });
      logActivity("creative", `Created project "${title}" in ${config.label}`);
    }
    setFormOpen(false);
    setEditingId(null);
    setFormTitle("");
    setFormBody("");
    refresh(activeSuite);
  }

  function handleDelete(project: CreativeProject) {
    deleteProject(project.id);
    logActivity("creative", `Deleted project "${project.title}"`);
    if (editingId === project.id) {
      setFormOpen(false);
      setEditingId(null);
    }
    refresh(activeSuite);
  }

  function handleShare(project: CreativeProject) {
    const draftToShare: ShareDraft = {
      title: project.title,
      body: project.body,
      suite: project.suite,
      ring: "public",
    };
    sendToShareCenter(draftToShare);
    logActivity(
      "creative",
      `Sent "${project.title}" (${config.label}) to the Share Center`,
    );
    router.push("/share");
  }

  async function handleGenerate() {
    const request = prompt.trim();
    if (request === "") {
      setGenerateError("Describe what you want to create first.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setDraftSaved(false);
    try {
      const response = await getProvider().chat({
        messages: [
          { role: "system", content: CREATOR_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Suite: ${config.label}\nTone: ${tone}\nLength: ${length}\n\n` +
              `Request: ${request}`,
          },
        ],
      });
      setDraft(response.content);
      setDraftBackend(response.backend);
      setDraftModel(response.model);
      const firstLine = request.split("\n")[0]?.trim() ?? "";
      setDraftTitle(
        firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine ||
          `${config.label} draft`,
      );
    } catch {
      setGenerateError(
        "Generation failed. The provider could not be reached — check the connection and try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleSaveDraft() {
    if (draft === null) return;
    const title = draftTitle.trim() || `${config.label} draft`;
    const saved = saveProject({ suite: activeSuite, title, body: draft });
    logActivity(
      "creative",
      `Saved AI draft as project "${saved.title}" in ${config.label}`,
    );
    setDraftSaved(true);
    refresh(activeSuite);
  }

  return (
    <div>
      <h1 className="page-title">Creative Suites</h1>
      <p className="muted">
        Art, Music, Video, and Write workspaces for David Charles Bourassa.
        Projects are stored locally in this browser. AI drafts are labeled
        with the backend that actually produced them — live or offline
        fallback — and every draft is yours to shape and finish.
      </p>

      <div className="tabs" role="tablist" aria-label="Creative suites">
        {CREATIVE_SUITES.map((suite) => (
          <button
            key={suite}
            type="button"
            role="tab"
            aria-selected={activeSuite === suite}
            className={activeSuite === suite ? "tab active" : "tab"}
            onClick={() => handleSuiteChange(suite)}
          >
            {SUITE_CONFIG[suite].label}
          </button>
        ))}
      </div>

      <section className="card suite-panel" aria-label="Prompt composer">
        <h2>Prompt composer — {config.label}</h2>
        <p className="muted">{config.composerHint}</p>
        <div className="form-stack">
          <label className="form-field">
            <span>Prompt</span>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Describe what you want to create…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>Tone</span>
              <select
                className="select"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                {config.tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Length</span>
              <select
                className="select"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              >
                {config.lengths.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleGenerate()}
              disabled={generating}
            >
              {generating ? "Generating…" : "Generate with AI"}
            </button>
            <ProviderStatusBadge
              mode={providerStatus.mode}
              model={providerStatus.model}
            />
            {draftBackend !== null && (
              <BackendBadge
                backend={draftBackend}
                {...(draftModel !== null ? { model: draftModel } : {})}
              />
            )}
          </div>
          {generateError !== null && (
            <p className="error-note" role="alert">
              {generateError}
            </p>
          )}
        </div>

        {draft !== null && (
          <div className="draft-area">
            <div className="form-stack">
              <label className="form-field">
                <span>Draft title</span>
                <input
                  className="input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Draft — editable, yours to shape</span>
                <textarea
                  className="textarea"
                  rows={8}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setDraftSaved(false);
                  }}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={handleSaveDraft}
                >
                  Save as project
                </button>
                {draftBackend !== null && (
                  <BackendBadge
                    backend={draftBackend}
                    {...(draftModel !== null ? { model: draftModel } : {})}
                  />
                )}
                {draftSaved && (
                  <span className="saved-note">
                    Saved to {config.label} projects ✓
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="suite-section" aria-label="Projects">
        <div className="form-actions">
          <h2 style={{ margin: 0, flex: "1 1 auto" }}>
            {config.label} projects
          </h2>
          <button type="button" className="btn" onClick={openNewForm}>
            New project
          </button>
        </div>

        {formOpen && (
          <div className="card suite-panel">
            <div className="form-stack">
              <label className="form-field">
                <span>Title</span>
                <input
                  className="input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={`${config.label} project title`}
                />
              </label>
              <label className="form-field">
                <span>Body</span>
                <textarea
                  className="textarea"
                  rows={6}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Notes, draft text, treatment, lyrics sketch…"
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveForm}
                >
                  {editingId !== null ? "Save changes" : "Create project"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <p className="empty-note" style={{ marginTop: "1rem" }}>
            No {config.label} projects yet. Create one, or generate a draft
            above and save it as a project.
          </p>
        ) : (
          <div className="card-grid" style={{ marginTop: "1rem" }}>
            {projects.map((project) => (
              <article key={project.id} className="card">
                <h3 className="suite-card-title">{project.title}</h3>
                <p className="project-meta">
                  Updated {formatUpdated(project.updatedAt)}
                </p>
                <p className="project-excerpt">{excerpt(project.body)}</p>
                <div className="project-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => openEditForm(project)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-gold"
                    onClick={() => handleShare(project)}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleDelete(project)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
