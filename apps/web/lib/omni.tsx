"use client";

// Omni Execution store for the Omega Platform web shell.
// Holds the Phase 3B Omni runtime in this browser only: the agent
// registry, policy engine, evidence gateway, Omni planner (live via
// the Meta Model API when a key is configured — createOmniPlanner —
// with the deterministic offline planner as the fallback),
// executor and versioned memory vault from @omega/ai-core and its
// sibling packages, plus the demo-local communities the run creates.
// Everything is in-memory — a reload resets the whole Omni state,
// by design. Nothing is uploaded, persisted, or sent anywhere.
// The human approver for every Omni decision is the demo member
// owner (OMNI_OWNER_ID), labeled in the UI as "You (demo member
// owner)".
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  KNOWN_AGENT_DEFINITIONS,
  MetaModelClient,
  OMNI_GATEWAY_TOOL_IDS,
  OMNI_OWNER_ID,
  OMNI_PACKAGE_ACTIONS,
  OmniExecutor,
  PlanRejectedError,
  TERRA_AGENT_DEFINITIONS,
  approvePlan,
  buildEvidenceGateway,
  buildOmniPolicyState,
  buildOmniRegistry,
  createOmniPlanner,
  getKnownAgentDefinition,
  historyByAgent,
  historyForAgent as computeHistoryForAgent,
  type ActionHandler,
  type AgentProposal,
  type AgentRegistry,
  type AgentRunHistory,
  type ApproverRef,
  type ArtifactRef,
  type OmniAgentDefinition,
  type OmniPlan,
  type OmniPlanner,
  type OmniRun,
  type PlanStep,
} from "@omega/ai-core";
import type { Gateway } from "@omega/mcp-gateway";
import { PolicyEngine } from "@omega/policy-engine";
import { VersionedMemoryVault } from "@omega/legacy-engine";
import {
  generateSyntheticExport,
  parseFacebookExport,
  type NormalizedMemberGraph,
  type NormalizedPerson,
} from "@omega/meta-export";
import type { CosmosEdge, CosmosNode } from "@omega/cosmos-engine";
import { useDataset } from "@/lib/dataset";
import { sendToShareCenter } from "@/lib/sharebox";
import { logActivity } from "@/lib/activity";

/** The demo member owner — the human approver for every Omni action. */
export const APPROVER: ApproverRef = { id: OMNI_OWNER_ID, kind: "person" };
export const APPROVER_LABEL = "You (demo member owner)";

/**
 * The nine evidence-gateway tool ids offered in the propose-agent
 * form — @omega/ai-core's OMNI_GATEWAY_TOOL_IDS: the notes, files and
 * meta-export adapters the evidence gateway registers (notes.list,
 * notes.search, notes.get, files.list, files.read, files.search,
 * graph.summary, graph.listPeople, graph.searchPosts).
 */
export const GATEWAY_TOOL_IDS: readonly string[] = OMNI_GATEWAY_TOOL_IDS;

export interface CommunityPost {
  id: string;
  title: string;
  body: string;
  authorLabel: string;
  status: "draft" | "published";
  createdAt: string;
}

export interface Community {
  id: string;
  name: string;
  topic: string;
  status: "forming" | "launch-ready";
  visibilityNote: string;
  memberIds: string[];
  posts: CommunityPost[];
}

export interface FindingsBrief {
  title: string;
  text: string;
  evidenceCount: number;
  titles: string[];
  createdAt: string;
}

export interface OmniContextValue {
  agents: OmniAgentDefinition[];
  proposals: AgentProposal[];
  plans: OmniPlan[];
  runs: OmniRun[];
  communities: Community[];
  people: readonly NormalizedPerson[];
  graph: NormalizedMemberGraph;
  lastFindings: FindingsBrief | null;
  error: string | null;
  executing: boolean;
  /** Active planner mode — "live" only when a key is configured. */
  plannerMode: "live" | "offline";
  /** Model id for live drafts; null in offline mode. */
  plannerModelId: string | null;
  /**
   * Raw rejection reasons from the live planner (PlanRejectedError
   * errors joined), or null. UIs render it as
   * "Live planner output rejected: <plannerError>".
   */
  plannerError: string | null;
  planning: boolean;
  /** Per-agent run history (agent memory), keyed by agent id. */
  agentHistories: Readonly<Record<string, AgentRunHistory>>;
  historyForAgent: (agentId: string) => AgentRunHistory;
  proposeAgent: (
    def: OmniAgentDefinition,
    justification: string,
  ) => AgentProposal | null;
  approveProposal: (id: string) => void;
  rejectProposal: (id: string) => void;
  planGoal: (goal: string) => Promise<OmniPlan | null>;
  approvePlanById: (planId: string, vetoedStepIds?: readonly string[]) => void;
  executePlanById: (planId: string) => Promise<OmniRun | null>;
  publishCommunityPost: (communityId: string, postId: string) => void;
  clearError: () => void;
}

const OmniContext = createContext<OmniContextValue | null>(null);

const COMMUNITY_VISIBILITY_NOTE =
  "Visibility and content access are evaluated through the policy engine — demo-local";

// ---------------------------------------------------------------------------
// Small defensive readers (page style follows app/privacy/demo).
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rec(value: unknown): Rec {
  return isRecord(value) ? value : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "community" : slug;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Best-effort plain text for one gathered evidence result. */
function evidenceText(value: unknown, depth = 0): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined || depth > 3) return "";
  if (Array.isArray(value)) {
    return value.map((entry) => evidenceText(entry, depth + 1)).join("\n");
  }
  if (isRecord(value)) {
    const preferred = ["text", "summary", "content", "result", "data", "output"]
      .map((key) => evidenceText(value[key], depth + 1))
      .filter((part) => part !== "")
      .join("\n");
    if (preferred !== "") return preferred;
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

/** Pull finding titles (title/name fields) out of gathered evidence text. */
function extractEvidenceTitles(gathered: readonly unknown[]): string[] {
  const titles: string[] = [];
  const push = (candidate: string) => {
    const title = candidate.trim();
    if (title !== "" && !titles.includes(title) && titles.length < 8) {
      titles.push(title);
    }
  };
  const walk = (value: unknown, depth: number) => {
    if (depth > 4 || titles.length >= 8) return;
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry, depth + 1);
      return;
    }
    if (isRecord(value)) {
      if (typeof value.title === "string") push(value.title);
      else if (typeof value.name === "string") push(value.name);
      for (const entry of Object.values(value)) walk(entry, depth + 1);
    }
  };
  for (const item of gathered) {
    // Structured results first: walk the value itself so title/name
    // fields are picked up exactly as the tools returned them.
    const before = titles.length;
    walk(item, 0);
    if (titles.length > before) continue;
    const text = evidenceText(item);
    if (text === "") continue;
    try {
      walk(JSON.parse(text) as unknown, 0);
    } catch {
      // Not one JSON document — try line-by-line JSON, then plain text.
      let fromLines = false;
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          walk(JSON.parse(trimmed) as unknown, 0);
          fromLines = true;
        } catch {
          // Not JSON — keep scanning.
        }
      }
      if (!fromLines && titles.length === before) {
        const firstLine = text.split("\n").find((line) => line.trim() !== "");
        if (firstLine) push(firstLine.replace(/^#+\s*/, ""));
      }
    }
  }
  return titles;
}

// ---------------------------------------------------------------------------
// Executor action-handler context.
//
// @omega/ai-core's ActionHandler is (step, ctx) => artifacts, where
// ctx.gathered is a ReadonlyMap<stepId, unknown> of the evidence
// results the run's tool steps accumulated, and ctx.artifacts holds
// the artifacts produced so far. The handlers below are written
// against one local shape — plan (the plan currently executing,
// tracked by the provider in executingPlanRef), step, owner id, and
// gathered as a plain list — and getCore() adapts the executor's
// real (step, ctx) call into it.
// ---------------------------------------------------------------------------

interface WebActionContext {
  plan: OmniPlan;
  step: PlanStep;
  ownerId: string;
  gathered: readonly unknown[];
}

interface OmniCore {
  registry: AgentRegistry;
  policy: PolicyEngine;
  gateway: Gateway;
  planner: OmniPlanner;
  vault: VersionedMemoryVault;
  executor: OmniExecutor;
  graph: NormalizedMemberGraph;
}

export function OmniProvider({ children }: { children: ReactNode }) {
  const { setOmniAdditions } = useDataset();

  const [agents, setAgents] = useState<OmniAgentDefinition[]>([]);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [plans, setPlans] = useState<OmniPlan[]>([]);
  const [runs, setRuns] = useState<OmniRun[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [lastFindings, setLastFindings] = useState<FindingsBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [plannerMode, setPlannerMode] = useState<"live" | "offline">(
    "offline",
  );
  const [plannerModelId, setPlannerModelId] = useState<string | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  // Mutable mirrors the (created-once) action handlers read and write;
  // React state above is the rendering mirror of the same values.
  const communitiesRef = useRef<Community[]>([]);
  const findingsRef = useRef<FindingsBrief | null>(null);
  const plansRef = useRef<OmniPlan[]>([]);
  // The plan whose run is currently executing — action handlers
  // receive (step, ctx) from the executor, never the plan itself, so
  // they read it from here.
  const executingPlanRef = useRef<OmniPlan | null>(null);
  const setOmniAdditionsRef = useRef(setOmniAdditions);
  setOmniAdditionsRef.current = setOmniAdditions;
  const coreRef = useRef<OmniCore | null>(null);

  const writeCommunities = useCallback((next: Community[]) => {
    communitiesRef.current = next;
    setCommunities(next);
  }, []);

  const writePlans = useCallback((next: OmniPlan[]) => {
    plansRef.current = next;
    setPlans(next);
  }, []);

  // --- WEB action handlers -------------------------------------------------
  // Each handler performs its side effect in provider state and
  // returns the artifacts the executor records on the step receipt.
  // ("agents.propose" is built into the executor — no handler here.)

  const handleCommunityCreate = useCallback(
    (ctx: WebActionContext): readonly ArtifactRef[] => {
      const core = coreRef.current;
      const args = rec(ctx.step.args);
      const name = str(args.name, "Terra Tech Commons");
      const topic = str(args.topic, "Sustainable technology");
      const id = slugify(name);
      if (!communitiesRef.current.some((c) => c.id === id)) {
        const members = core ? core.graph.people.slice(0, 8) : [];
        writeCommunities([
          ...communitiesRef.current,
          {
            id,
            name,
            topic,
            status: "forming",
            visibilityNote: COMMUNITY_VISIBILITY_NOTE,
            memberIds: members.map((person) => person.id),
            posts: [],
          },
        ]);
        logActivity(
          "omni",
          `Omni run created the "${name}" community with ${members.length} founding members (demo-local)`,
        );
      }
      return [{ kind: "community", id, title: name }];
    },
    [writeCommunities],
  );

  const handleFindingsOrganize = useCallback(
    (ctx: WebActionContext): readonly ArtifactRef[] => {
      const titles = extractEvidenceTitles(ctx.gathered);
      const title = "Findings brief — sustainable technology evidence";
      const lines = [
        title,
        "",
        `Evidence results gathered through the gateway in this run: ${ctx.gathered.length}.`,
        "The brief below is organized from those results only — titles as returned by the tools.",
        "",
        "Top findings:",
        ...(titles.length > 0
          ? titles.map((t) => `- ${t}`)
          : ["- (no titled findings were returned by the evidence tools)"]),
      ];
      const brief: FindingsBrief = {
        title,
        text: lines.join("\n"),
        evidenceCount: ctx.gathered.length,
        titles,
        createdAt: new Date().toISOString(),
      };
      findingsRef.current = brief;
      setLastFindings(brief);
      logActivity(
        "omni",
        `Omni run organized a findings brief from ${brief.evidenceCount} evidence results (demo-local)`,
      );
      return [
        {
          kind: "findings-brief",
          id: `findings-brief-${ctx.plan.id}`,
          title,
          detail: `${brief.evidenceCount} evidence results · ${titles.length} titled findings`,
        },
      ];
    },
    [],
  );

  const handleShareCreateDraft = useCallback(
    (ctx: WebActionContext): readonly ArtifactRef[] => {
      const args = rec(ctx.step.args);
      const title = str(
        args.title,
        "What the evidence says about sustainable technology",
      );
      const brief = findingsRef.current;
      const titles = brief?.titles ?? extractEvidenceTitles(ctx.gathered);
      const paragraphs = [
        "Drafted by the Terra Creator agent for the Terra Tech Commons community. This is an agent-written educational post — labeled as such, and held as a draft until a person reviews and publishes it.",
        brief
          ? `It pulls together a findings brief organized from ${brief.evidenceCount} evidence results gathered through the platform's tool gateway during this run — public, citable sources only, each one receipted by the gateway when it was retrieved.`
          : "It pulls together evidence gathered through the platform's tool gateway during this run — public, citable sources only, each one receipted by the gateway when it was retrieved.",
        titles.length > 0
          ? `Highlights from the evidence: ${titles.slice(0, 4).join("; ")}. Each item is worth a slower read than a feed usually allows — the brief keeps the titles together so the community can follow the thread back to the sources.`
          : "The evidence set for this topic is still thin, which is itself a finding: the community's first job is gathering better sources before drawing conclusions.",
        "A good starting practice, whatever the technology: prefer the option you can repair, measure its effect in your own context, and share what you learn — that loop is the whole method, and it works at kitchen-table scale as well as city scale.",
        "Demo note: this draft was composed locally in this browser by an offline-planned agent run. Nothing has been posted anywhere; publishing is a separate, human step.",
      ];
      const body = paragraphs.join("\n\n");
      // The Share Center hand-off — lib/sharebox's real API: the draft
      // waits in localStorage for the Share Center to pick it up once.
      sendToShareCenter({ title, body, suite: "write", ring: "public" });
      const postId = `post-${slugify(ctx.plan.id)}-${slugify(ctx.step.id)}`;
      const targetId =
        str(args.communityId) || communitiesRef.current[0]?.id || "";
      if (targetId !== "") {
        writeCommunities(
          communitiesRef.current.map((community) =>
            community.id === targetId
              ? {
                  ...community,
                  posts: [
                    ...community.posts,
                    {
                      id: postId,
                      title,
                      body,
                      authorLabel: "Terra Creator (agent draft — demo)",
                      status: "draft" as const,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : community,
          ),
        );
      }
      logActivity(
        "omni",
        `Omni run drafted "${title}" to the Share Center and the community drafts (demo-local)`,
      );
      return [
        {
          kind: "share-draft",
          id: postId,
          title,
          detail: "Draft in Share Center + community drafts (demo-local)",
        },
      ];
    },
    [writeCommunities],
  );

  const handleLaunchChecklist = useCallback(
    (ctx: WebActionContext): readonly ArtifactRef[] => {
      const args = rec(ctx.step.args);
      const targetId =
        str(args.communityId) || communitiesRef.current[0]?.id || "";
      const community = communitiesRef.current.find((c) => c.id === targetId);
      // Privacy is genuinely evaluated through this provider's policy
      // engine, on this step's own policy resource — an evaluation
      // that returns a decision (allow or deny) counts as evaluated;
      // a throw (unknown resource) does not.
      let privacyEvaluated = false;
      const core = coreRef.current;
      if (core && community) {
        try {
          const decision: unknown = core.policy.evaluate({
            subjectId: OMNI_OWNER_ID,
            resourceId: ctx.step.resourceId,
            action: "view",
          });
          privacyEvaluated = isRecord(decision);
        } catch {
          privacyEvaluated = false;
        }
      }
      const items: { label: string; done: boolean }[] = [
        {
          label: "Community created in this browser (demo-local)",
          done: community !== undefined,
        },
        {
          label: "Evidence gathered with provenance (gateway receipts)",
          done: ctx.gathered.length > 0 || findingsRef.current !== null,
        },
        {
          label: "Privacy evaluated via the policy engine",
          done: privacyEvaluated,
        },
        {
          label: "Draft educational content present",
          done: (community?.posts.length ?? 0) > 0,
        },
      ];
      if (community) {
        writeCommunities(
          communitiesRef.current.map((c) =>
            c.id === community.id
              ? { ...c, status: "launch-ready" as const }
              : c,
          ),
        );
        logActivity(
          "omni",
          `Omni run marked "${community.name}" launch-ready (demo-local)`,
        );
      }
      const doneCount = items.filter((item) => item.done).length;
      return [
        {
          kind: "checklist",
          id: `launch-checklist-${targetId || "community"}`,
          title: `Launch checklist — ${community?.name ?? "community"}`,
          detail: `${doneCount}/${items.length} complete — ${items
            .map((item) => `${item.done ? "✓" : "…"} ${item.label}`)
            .join(" · ")}`,
        },
      ];
    },
    [writeCommunities],
  );

  const handleCosmosAddNodes = useCallback(
    (ctx: WebActionContext): readonly ArtifactRef[] => {
      void ctx;
      const community = communitiesRef.current[0];
      const nodes: CosmosNode[] = [];
      const edges: CosmosEdge[] = [];
      if (community) {
        nodes.push({
          id: `omni-community-${community.id}`,
          kind: "company",
          ring: "public",
          label: community.name,
          branch: "omni",
        });
      }
      for (const def of TERRA_AGENT_DEFINITIONS) {
        nodes.push({
          id: `omni-agent-${def.id}`,
          kind: "member",
          ring: "public",
          label: def.name,
          branch: "omni",
        });
        if (community) {
          edges.push({
            source: `omni-community-${community.id}`,
            target: `omni-agent-${def.id}`,
            kind: "relationship",
          });
        }
      }
      // Additions live in the dataset store (see lib/dataset.tsx) —
      // the Cosmos page merges them into the synthetic dataset.
      setOmniAdditionsRef.current({ nodes, edges });
      return [
        {
          kind: "cosmos-nodes",
          id: "omni-cosmos-additions",
          title: "Cosmos additions",
          detail: "community + 3 agents",
        },
      ];
    },
    [],
  );

  // --- Core construction (once) ---------------------------------------------

  const getCore = useCallback((): OmniCore => {
    if (coreRef.current) return coreRef.current;
    const registry = buildOmniRegistry();
    const policy = new PolicyEngine(buildOmniPolicyState());
    const gateway = buildEvidenceGateway();
    // Live when a Meta Model API key is configured, offline
    // otherwise — createOmniPlanner decides from the shared env
    // status. The validation context is a provider resolved per
    // plan, so agents approved after startup are known to the
    // validator when a later plan is drafted.
    const planner = createOmniPlanner({
      validationContext: () => ({
        knownAgentIds: registry.listAgents().map((agent) => agent.id),
        knownToolIds: OMNI_GATEWAY_TOOL_IDS,
        knownActionIds: OMNI_PACKAGE_ACTIONS,
        getKnownAgentDefinition,
        knownAgentDefinitions: KNOWN_AGENT_DEFINITIONS,
      }),
    });
    const vault = new VersionedMemoryVault();
    const graph = parseFacebookExport(generateSyntheticExport(42));
    // Adapt the executor's real ActionHandler call — (step, ctx)
    // with ctx.gathered a ReadonlyMap<stepId, unknown> — into the
    // local WebActionContext the handlers above are written against.
    // The executing plan comes from executingPlanRef: the executor
    // never passes the plan to handlers.
    const webHandler =
      (
        run: (ctx: WebActionContext) => readonly ArtifactRef[],
      ): ActionHandler =>
      (step, ctx) => {
        const plan = executingPlanRef.current;
        if (plan === null) {
          throw new Error("Omni action handler called outside a run");
        }
        return run({
          plan,
          step,
          ownerId: OMNI_OWNER_ID,
          gathered: [...ctx.gathered.values()],
        });
      };
    const actionHandlers: Readonly<Record<string, ActionHandler>> = {
      "community.create": webHandler(handleCommunityCreate),
      "findings.organize": webHandler(handleFindingsOrganize),
      "share.createDraft": webHandler(handleShareCreateDraft),
      "community.launchChecklist": webHandler(handleLaunchChecklist),
      "cosmos.addNodes": webHandler(handleCosmosAddNodes),
    };
    const executor = new OmniExecutor({
      registry,
      policy,
      gateway,
      ownerId: OMNI_OWNER_ID,
      actionHandlers,
      vault,
      // Phase 4 (Alive Pass): run reflections are written by the live
      // model when a key is configured; MetaModelClient self-falls-back
      // and summarizeRun labels the source honestly either way.
      summaryClient: new MetaModelClient(),
    });
    const core: OmniCore = {
      registry,
      policy,
      gateway,
      planner,
      vault,
      executor,
      graph,
    };
    coreRef.current = core;
    return core;
  }, [
    handleCommunityCreate,
    handleFindingsOrganize,
    handleShareCreateDraft,
    handleLaunchChecklist,
    handleCosmosAddNodes,
  ]);

  const syncRegistry = useCallback(() => {
    const core = getCore();
    setAgents([...core.registry.listAgents()]);
    setProposals([...core.registry.listProposals()]);
    setPlannerMode(core.planner.mode);
    setPlannerModelId(core.planner.modelId ?? null);
  }, [getCore]);

  // Build the core and mirror the registry once, on mount (client
  // only — nothing Omni exists during server rendering).
  useEffect(() => {
    syncRegistry();
  }, [syncRegistry]);

  // --- Provider actions -------------------------------------------------------

  const proposeAgent = useCallback(
    (def: OmniAgentDefinition, justification: string): AgentProposal | null => {
      try {
        const proposal = getCore().registry.propose(
          def,
          justification,
          OMNI_OWNER_ID,
        );
        syncRegistry();
        setError(null);
        logActivity(
          "omni",
          `Agent proposal submitted: ${def.name} (${def.id}) — awaiting approval`,
        );
        return proposal;
      } catch (caught) {
        setError(errorMessage(caught));
        return null;
      }
    },
    [getCore, syncRegistry],
  );

  const approveProposal = useCallback(
    (id: string) => {
      try {
        getCore().registry.approve(id, APPROVER);
        syncRegistry();
        setError(null);
        logActivity("omni", `Agent proposal ${id} approved by ${APPROVER_LABEL}`);
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [getCore, syncRegistry],
  );

  const rejectProposal = useCallback(
    (id: string) => {
      try {
        getCore().registry.reject(id, APPROVER);
        syncRegistry();
        setError(null);
        logActivity("omni", `Agent proposal ${id} rejected by ${APPROVER_LABEL}`);
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [getCore, syncRegistry],
  );

  const planGoal = useCallback(
    async (goal: string): Promise<OmniPlan | null> => {
      setPlanning(true);
      try {
        const core = getCore();
        const plan = await core.planner.plan(goal);
        writePlans([
          ...plansRef.current.filter((p) => p.id !== plan.id),
          plan,
        ]);
        setError(null);
        setPlannerError(null);
        logActivity(
          "omni",
          plan.plannerMode === "live"
            ? `Live planner (Meta Model API · ${plan.plannerModelId ?? core.planner.modelId ?? "model"}) created plan ${plan.id} (${plan.steps.length} steps) — proposed, awaiting approval`
            : `Offline planner created plan ${plan.id} (${plan.steps.length} steps) — proposed, awaiting approval`,
        );
        return plan;
      } catch (caught) {
        if (caught instanceof PlanRejectedError) {
          // Loud rejection state: the raw reasons go to plannerError
          // (the Review UI renders "Live planner output rejected: …")
          // and the prefixed message goes to the general error slot
          // the existing pages already display. No fallback plan is
          // created — a rejected live draft produces NO plan.
          const reasons = caught.errors.join("; ");
          setPlannerError(reasons);
          setError(`Live planner output rejected: ${reasons}`);
        } else {
          setError(errorMessage(caught));
        }
        return null;
      } finally {
        setPlanning(false);
      }
    },
    [getCore, writePlans],
  );

  const approvePlanById = useCallback(
    (planId: string, vetoedStepIds: readonly string[] = []) => {
      const plan = plansRef.current.find((p) => p.id === planId);
      if (!plan) {
        setError(`Unknown plan: ${planId}`);
        return;
      }
      try {
        const approved = approvePlan(plan, APPROVER, vetoedStepIds);
        writePlans(
          plansRef.current.map((p) => (p.id === planId ? approved : p)),
        );
        setError(null);
        logActivity(
          "omni",
          `Plan ${planId} approved by ${APPROVER_LABEL}${vetoedStepIds.length > 0 ? ` — ${vetoedStepIds.length} step(s) vetoed` : ""}`,
        );
      } catch (caught) {
        setError(errorMessage(caught));
      }
    },
    [writePlans],
  );

  const executePlanById = useCallback(
    async (planId: string): Promise<OmniRun | null> => {
      const plan = plansRef.current.find((p) => p.id === planId);
      if (!plan) {
        setError(`Unknown plan: ${planId}`);
        return null;
      }
      setExecuting(true);
      executingPlanRef.current = plan;
      try {
        const run = await getCore().executor.execute(plan);
        setRuns((prev) => [...prev, run]);
        syncRegistry();
        setError(null);
        logActivity(
          "omni",
          `Omni run ${run.id} ${run.status} — ${run.receipts.length} step receipts`,
        );
        return run;
      } catch (caught) {
        setError(errorMessage(caught));
        return null;
      } finally {
        executingPlanRef.current = null;
        setExecuting(false);
      }
    },
    [getCore, syncRegistry],
  );

  const publishCommunityPost = useCallback(
    (communityId: string, postId: string) => {
      writeCommunities(
        communitiesRef.current.map((community) =>
          community.id === communityId
            ? {
                ...community,
                posts: community.posts.map((post) =>
                  post.id === postId
                    ? { ...post, status: "published" as const }
                    : post,
                ),
              }
            : community,
        ),
      );
      logActivity(
        "omni",
        `Community post ${postId} published to the demo-local feed by ${APPROVER_LABEL}`,
      );
    },
    [writeCommunities],
  );

  const clearError = useCallback(() => setError(null), []);

  // Agent memory: completed runs are retained in `runs` above; the
  // per-agent history is derived purely from their receipts (plus
  // each run's summary once the executor's summary hook attaches
  // one — historyForAgent reads `summary` defensively, so runs
  // without one still count).
  const agentHistories = useMemo(
    () => historyByAgent(runs),
    [runs],
  );
  const historyForAgent = useCallback(
    (agentId: string): AgentRunHistory =>
      computeHistoryForAgent(runs, agentId),
    [runs],
  );

  const people = coreRef.current?.graph.people ?? FALLBACK_PEOPLE;
  const graph = coreRef.current?.graph ?? FALLBACK_GRAPH;

  const value = useMemo<OmniContextValue>(
    () => ({
      agents,
      proposals,
      plans,
      runs,
      communities,
      people,
      graph,
      lastFindings,
      error,
      executing,
      plannerMode,
      plannerModelId,
      plannerError,
      planning,
      agentHistories,
      historyForAgent,
      proposeAgent,
      approveProposal,
      rejectProposal,
      planGoal,
      approvePlanById,
      executePlanById,
      publishCommunityPost,
      clearError,
    }),
    [
      agents,
      proposals,
      plans,
      runs,
      communities,
      people,
      graph,
      lastFindings,
      error,
      executing,
      plannerMode,
      plannerModelId,
      plannerError,
      planning,
      agentHistories,
      historyForAgent,
      proposeAgent,
      approveProposal,
      rejectProposal,
      planGoal,
      approvePlanById,
      executePlanById,
      publishCommunityPost,
      clearError,
    ],
  );

  return <OmniContext.Provider value={value}>{children}</OmniContext.Provider>;
}

// The synthetic demo graph is deterministic (seed 42), so the people
// strip and member lists can render before the core is built on
// mount; the provider swaps in the core's own parsed graph after.
const FALLBACK_GRAPH: NormalizedMemberGraph = parseFacebookExport(
  generateSyntheticExport(42),
);
const FALLBACK_PEOPLE: readonly NormalizedPerson[] = FALLBACK_GRAPH.people;

export function useOmni(): OmniContextValue {
  const ctx = useContext(OmniContext);
  if (!ctx) {
    throw new Error("useOmni must be used inside <OmniProvider>");
  }
  return ctx;
}
