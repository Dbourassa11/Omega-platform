/**
 * @omega/ai-core — Omni demo substrate (Phase 3B)
 *
 * Fictional, clearly synthetic data and builders shared by the
 * ai-core tests AND the web app's Omni demo surface:
 *
 * - EVIDENCE_NOTES / EVIDENCE_FILES: a tiny sustainable-technology
 *   evidence corpus (fictional authors, fictional projects).
 * - TERRA_AGENT_DEFINITIONS: the three specialized agents the demo
 *   plan proposes (terra-research / terra-creator / terra-archivist).
 * - buildOmniPolicyState(): a policy state whose ONLY access path is
 *   the executor's per-step task passes — `grants` is deliberately
 *   empty; all access flows through run passes, and every pass
 *   expires when the run's task completes.
 * - buildEvidenceGateway(): a real @omega/mcp-gateway gateway wired
 *   to the evidence corpus + the synthetic member graph (seed 42).
 * - buildOmniRegistry(): the agent registry founder-seeded with the
 *   canonical fabric.
 *
 * Creator: David Charles Bourassa
 */

import { createGateway } from "@omega/mcp-gateway/browser";
import type { Gateway } from "@omega/mcp-gateway/browser";
import {
  createFilesTools,
  createMemoryFileProvider,
  createMetaExportTools,
  createNotesTools,
} from "@omega/mcp-gateway/browser";
import type { NoteInput } from "@omega/mcp-gateway/browser";
import { generateSyntheticExport, parseFacebookExport } from "@omega/meta-export";
import type {
  PolicyResource,
  PolicyState,
  PolicySubject,
} from "@omega/policy-engine";

import { AGENT_FABRIC } from "./agents.js";
import { AgentRegistry, fabricToOmniDefinition } from "./registry.js";
import type { OmniAgentDefinition } from "./registry.js";

export const OMNI_OWNER_ID = "member:ada";

/** The 9 ungated gateway tool ids the evidence gateway registers. */
export const OMNI_GATEWAY_TOOL_IDS: readonly string[] = [
  "notes.list",
  "notes.search",
  "notes.get",
  "files.list",
  "files.read",
  "files.search",
  "graph.summary",
  "graph.listPeople",
  "graph.searchPosts",
] as const;

// ---------------------------------------------------------------------------
// Evidence corpus — fictional sustainable-technology notes & files
// ---------------------------------------------------------------------------

export const EVIDENCE_NOTES: NoteInput[] = [
  {
    id: "solar-microgrids",
    markdown: [
      "# Solar Microgrids for Small Towns",
      "",
      "A fictional field note by Mara Ellison on solar microgrids: a 40-panel solar array paired with a community battery kept the fictional town of Las Flores powered through a two-day grid outage.",
      "Solar cooperatives let neighbours co-own the array and share the surplus.",
    ].join("\n"),
  },
  {
    id: "battery-storage",
    markdown: [
      "# Battery Storage, Plainly Explained",
      "",
      "A fictional explainer by Theo Lindqvist: storage shifts midday solar surplus into the evening peak, and second-life EV batteries are becoming the cheapest storage tier for community projects.",
      "Round-trip efficiency and degradation curves decide the real cost, not the sticker price.",
    ].join("\n"),
  },
  {
    id: "geothermal-basics",
    markdown: [
      "# Geothermal Basics",
      "",
      "A fictional primer by Priya Nair: ground-source heat pumps move heat rather than making it, delivering three to five units of heat per unit of electricity in the fictional Valle Verde housing pilot.",
      "Drilling cost is the barrier; shared ground loops across a housing block cut it sharply.",
    ].join("\n"),
  },
  {
    id: "grid-software",
    markdown: [
      "# Grid Software and Demand Flexibility",
      "",
      "A fictional note by Jonas Weber: demand-flexibility software staggers EV charging and water heating so a local grid can absorb more solar and wind without new wires.",
      "The fictional Gridwise pilot shaved 18% off its evening peak in one season.",
    ].join("\n"),
  },
  {
    id: "passive-housing",
    markdown: [
      "# Passive Housing Retrofits",
      "",
      "A fictional case study by Ana Beltrán: deep insulation, airtightness, and heat-recovery ventilation cut heating demand by 80% in a fictional retrofit of the Calle Sol apartments.",
      "Residents reported steadier indoor temperatures through both heat waves and cold snaps.",
    ].join("\n"),
  },
];

export const EVIDENCE_FILES: Record<string, string> = {
  "solar-cooperative-brief.md": [
    "# Solar Cooperative Brief (fictional)",
    "",
    "A fictional brief on forming a solar cooperative: members buy shares in a shared solar array, the cooperative owns the panels, and credits flow back on each member's bill.",
    "Solar output in the fictional Solana Cooperative reached 210 MWh in its first year.",
  ].join("\n"),
  "storage-costs-2026.txt": [
    "Storage costs 2026 (fictional figures)",
    "",
    "Community-scale lithium storage: fictional installed cost $310/kWh, falling.",
    "Second-life EV packs: fictional installed cost $120/kWh, with shorter warranted life.",
  ].join("\n"),
  "geothermal-overview.md": [
    "# Geothermal Overview (fictional)",
    "",
    "A fictional overview: shared ground-loop fields serve whole housing blocks,",
    "and district geothermal pairs naturally with passive-housing retrofits.",
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// The three specialized agents the demo plan proposes
// ---------------------------------------------------------------------------

const TERRA_PROVENANCE = {
  citations: true,
  disclosure: true,
  receipt: true as const,
  stateLabel: true,
};

export const TERRA_AGENT_DEFINITIONS: readonly OmniAgentDefinition[] = [
  {
    id: "terra-research",
    name: "Terra Research",
    role: "Research agent — gathers authorized evidence",
    ringScope: ["work", "public"],
    toolAllowlist: [
      "notes.search",
      "notes.list",
      "notes.get",
      "files.search",
      "files.read",
      "files.list",
    ],
    actionAllowlist: [],
    skillIds: ["evidence-research", "graph-analysis"],
    domainScope: ["intellectual-property"],
    policySubjectId: "agent:terra-research",
    provenanceRequirements: { ...TERRA_PROVENANCE },
    status: "proposed",
  },
  {
    id: "terra-creator",
    name: "Terra Creator",
    role: "Creator agent — drafts educational content from approved findings",
    ringScope: ["work", "public"],
    toolAllowlist: [],
    actionAllowlist: ["share.createDraft"],
    skillIds: ["findings-writing"],
    domainScope: ["intellectual-property", "social"],
    policySubjectId: "agent:terra-creator",
    provenanceRequirements: { ...TERRA_PROVENANCE },
    status: "proposed",
  },
  {
    id: "terra-archivist",
    name: "Terra Archivist",
    role: "Archivist agent — inventories evidence and organizes findings",
    ringScope: ["work", "public"],
    toolAllowlist: ["notes.list", "graph.summary"],
    actionAllowlist: ["findings.organize"],
    skillIds: ["archive-curation", "graph-analysis"],
    domainScope: ["intellectual-property", "social"],
    policySubjectId: "agent:terra-archivist",
    provenanceRequirements: { ...TERRA_PROVENANCE },
    status: "proposed",
  },
];

export function getTerraAgentDefinition(
  id: string,
): OmniAgentDefinition | undefined {
  return TERRA_AGENT_DEFINITIONS.find((definition) => definition.id === id);
}

// ---------------------------------------------------------------------------
// The generic-goal research agent the planner proposes for any
// free-form goal that is not the community-build demo (see
// planner.ts genericSteps()).
// ---------------------------------------------------------------------------

export const RESEARCH_AGENT_DEFINITION: OmniAgentDefinition = {
  id: "research-agent",
  name: "Research Agent",
  role: "Research agent — gathers authorized evidence and organizes findings for a member goal",
  ringScope: ["work", "public"],
  toolAllowlist: ["notes.search", "notes.list", "notes.get"],
  actionAllowlist: ["findings.organize"],
  skillIds: ["evidence-research", "findings-writing"],
  domainScope: ["intellectual-property"],
  policySubjectId: "agent:research-agent",
  provenanceRequirements: { ...TERRA_PROVENANCE },
  status: "proposed",
};

/** Every agent definition the executor's agents.propose knows. */
export const KNOWN_AGENT_DEFINITIONS: readonly OmniAgentDefinition[] = [
  ...TERRA_AGENT_DEFINITIONS,
  RESEARCH_AGENT_DEFINITION,
];

export function getKnownAgentDefinition(
  id: string,
): OmniAgentDefinition | undefined {
  return KNOWN_AGENT_DEFINITIONS.find((definition) => definition.id === id);
}

// ---------------------------------------------------------------------------
// Policy state — grants intentionally empty: access flows through
// the executor's per-run, per-step task passes only.
// ---------------------------------------------------------------------------

function resource(
  r: Pick<PolicyResource, "id" | "domain" | "title" | "sensitivity">,
): PolicyResource {
  return { ...r, ownerId: OMNI_OWNER_ID, summary: `${r.title} (demo resource).` };
}

export function buildOmniPolicyState(): PolicyState {
  const subjects: PolicySubject[] = [
    { id: OMNI_OWNER_ID, kind: "person", displayName: "Ada Whitfield (demo member)" },
    ...AGENT_FABRIC.map(
      (f): PolicySubject => ({
        id: `agent:${f.id}`,
        kind: "agent",
        displayName: f.name,
      }),
    ),
    ...KNOWN_AGENT_DEFINITIONS.map(
      (d): PolicySubject => ({
        id: d.policySubjectId,
        kind: "agent",
        displayName: d.name,
      }),
    ),
  ];
  const resources: PolicyResource[] = [
    resource({
      id: "evidence:notes",
      domain: "intellectual-property",
      title: "Evidence corpus — notes",
      sensitivity: "internal",
    }),
    resource({
      id: "evidence:files",
      domain: "intellectual-property",
      title: "Evidence corpus — files",
      sensitivity: "internal",
    }),
    resource({
      id: "member:graph",
      domain: "social",
      title: "Member graph",
      sensitivity: "internal",
    }),
    resource({
      id: "community:terra-tech",
      domain: "social",
      title: "Terra Tech Commons community",
      sensitivity: "internal",
    }),
    resource({
      id: "findings:terra-tech",
      domain: "intellectual-property",
      title: "Terra Tech findings",
      sensitivity: "internal",
    }),
    resource({
      id: "findings:research",
      domain: "intellectual-property",
      title: "Research findings",
      sensitivity: "internal",
    }),
    resource({
      id: "share:drafts",
      domain: "intellectual-property",
      title: "Share Center drafts",
      sensitivity: "internal",
    }),
    resource({
      id: "agents:registry",
      domain: "ai-agents",
      title: "Agent registry",
      sensitivity: "internal",
    }),
    resource({
      id: "cosmos:dataset",
      domain: "social",
      title: "Knowledge cosmos dataset",
      sensitivity: "internal",
    }),
    // The never-granted resource: no demo agent scopes the financial
    // domain for this resource, so any step aimed at it is denied at
    // the executor's bound check — the out-of-scope test target.
    resource({
      id: "vault:private-finances",
      domain: "financial",
      title: "Private finances vault",
      sensitivity: "restricted",
    }),
  ];
  return {
    subjects,
    groups: [],
    resources,
    grants: [],
    denials: [],
    requests: [],
    legacyDirectives: [],
  };
}

// ---------------------------------------------------------------------------
// Gateway + registry builders
// ---------------------------------------------------------------------------

export function buildEvidenceGateway(): Gateway {
  const gateway = createGateway();
  for (const tool of createNotesTools(EVIDENCE_NOTES)) {
    gateway.registerTool(tool);
  }
  for (const tool of createFilesTools(createMemoryFileProvider(EVIDENCE_FILES))) {
    gateway.registerTool(tool);
  }
  const graph = parseFacebookExport(generateSyntheticExport(42));
  for (const tool of createMetaExportTools(graph)) {
    gateway.registerTool(tool);
  }
  return gateway;
}

export function buildOmniRegistry(): AgentRegistry {
  // The host-supplied known tool set: the 9 gateway tool ids PLUS the
  // fabric capability ids the canonical agents name in their
  // toolAllowlists (in-package capabilities, not gateway tools).
  const knownToolIds = new Set<string>(OMNI_GATEWAY_TOOL_IDS);
  for (const f of AGENT_FABRIC) {
    for (const toolId of f.toolAllowlist) {
      knownToolIds.add(toolId);
    }
  }
  const registry = new AgentRegistry({ knownToolIds });
  for (const f of AGENT_FABRIC) {
    registry.registerActive(fabricToOmniDefinition(f));
  }
  return registry;
}
