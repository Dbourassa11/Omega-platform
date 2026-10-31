/**
 * @omega/meta-export — Facebook DYI export parser / normalizer
 *
 * Filename-suffix matching (path prefixes are tolerated). A single
 * malformed or missing file never throws: bad files are skipped and
 * unknown files are ignored.
 *
 * Ring inference (deterministic, in precedence order):
 *   1. override   — explicit RingOverride for the person
 *   2. list       — a friend list classifies the person (most
 *                   restrictive list wins: family > friends > work >
 *                   public)
 *   3. inferred   — messageCount >= 25 implies "friends"
 *   4. default    — "family", deny-by-default (see README)
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";

import { personIdForName, slugify } from "./slug.js";
import type {
  ExportFileEntry,
  NormalizedMedia,
  NormalizedMemberGraph,
  NormalizedPerson,
  NormalizedPost,
  NormalizedThread,
  RingCounts,
  RingOverride,
  RingSource,
} from "./types.js";

/** Restrictiveness rank: lower is more restrictive (more private). */
const RING_RANK: Record<RingType, number> = {
  family: 0,
  friends: 1,
  work: 2,
  public: 3,
};

const MESSAGE_FRIENDS_THRESHOLD = 25;

function mostRestrictive(a: RingType, b: RingType): RingType {
  return RING_RANK[a] <= RING_RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Loose shape helpers — a bad value never throws, it just fails the check.
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

/** Extract a non-empty name string from entries shaped like `{ name }`. */
function namesFromNameEntries(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const names: string[] = [];
  for (const entry of v) {
    if (typeof entry === "string" && entry.length > 0) {
      names.push(entry);
    } else if (isRecord(entry)) {
      const name = asString(entry["name"]);
      if (name !== undefined) names.push(name);
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// File classification by suffix (prefix-tolerant)
// ---------------------------------------------------------------------------

type FileKind = "friends" | "friendLists" | "posts" | "album" | "thread" | "synthetic" | "unknown";

function classifyPath(rawPath: string): FileKind {
  const path = rawPath.replace(/\\/g, "/").toLowerCase();
  if (path.endsWith("synthetic_fixture_readme.txt")) return "synthetic";
  if (path.endsWith(".json")) {
    if (path.includes("friend_lists")) return "friendLists";
    if (/\/album_\d+\.json$/.test(path) || path.endsWith("album_0.json")) return "album";
    if (/message_\d+\.json$/.test(path) && path.includes("messages/")) return "thread";
    if (/your_posts(_\d+)?\.json$/.test(path)) return "posts";
    if (path.endsWith("friends.json")) return "friends";
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Raw intermediate shapes
// ---------------------------------------------------------------------------

interface RawThread {
  participants: string[];
  messages: { sender: string; timestampMs: number }[];
  title?: string;
  threadPath?: string;
}

interface RawList {
  name: string;
  members: string[];
}

function ringForListName(listName: string): RingType | undefined {
  const n = listName.toLowerCase();
  if (n.includes("family")) return "family";
  if (n.includes("close")) return "friends";
  if (n.includes("work") || n.includes("colleague") || n.includes("coworker")) return "work";
  if (n.includes("acquaintance")) return "public";
  return undefined;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseFacebookExport(
  files: readonly ExportFileEntry[],
  overrides?: readonly RingOverride[],
): NormalizedMemberGraph {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  let synthetic = false;
  const friendNames: string[] = [];
  const friendLists: RawList[] = [];
  const rawThreads: RawThread[] = [];
  const rawPosts: { timestamp: number; text: string; title?: string }[] = [];
  const rawMedia: { title: string; album?: string; timestamp: number; albumName: string }[] = [];

  for (const file of sorted) {
    const kind = classifyPath(file.path);
    if (kind === "synthetic") {
      synthetic = true;
      continue;
    }
    if (kind === "unknown") continue;

    const data = parseJson(file.content);
    if (data === undefined) continue; // malformed file: skip gracefully

    if (kind === "friends") {
      if (!isRecord(data)) continue;
      friendNames.push(...namesFromNameEntries(data["friends_v2"] ?? data["friends"]));
    } else if (kind === "friendLists") {
      if (!isRecord(data)) continue;
      const lists = data["friend_lists_v2"] ?? data["friend_lists"];
      if (!Array.isArray(lists)) continue;
      for (const entry of lists) {
        if (!isRecord(entry)) continue;
        const name = asString(entry["name"]);
        if (name === undefined) continue;
        friendLists.push({ name, members: namesFromNameEntries(entry["members"]) });
      }
    } else if (kind === "posts") {
      const entries = Array.isArray(data) ? data : isRecord(data) ? [data] : [];
      for (const entry of entries) {
        if (!isRecord(entry)) continue;
        const timestamp = asNumber(entry["timestamp"]) ?? 0;
        let text = "";
        const dataField = entry["data"];
        if (Array.isArray(dataField)) {
          for (const part of dataField) {
            if (isRecord(part)) {
              const postText = asString(part["post"]);
              if (postText !== undefined) {
                text = postText;
                break;
              }
            }
          }
        }
        const title = asString(entry["title"]);
        rawPosts.push(title !== undefined ? { timestamp, text, title } : { timestamp, text });
      }
    } else if (kind === "album") {
      if (!isRecord(data)) continue;
      const albumName = asString(data["name"]) ?? "Untitled Album";
      const photos = data["photos"];
      if (!Array.isArray(photos)) continue;
      for (const photo of photos) {
        if (!isRecord(photo)) continue;
        rawMedia.push({
          title: asString(photo["title"]) ?? albumName,
          album: albumName,
          timestamp: asNumber(photo["creation_timestamp"]) ?? 0,
          albumName,
        });
      }
    } else if (kind === "thread") {
      if (!isRecord(data)) continue;
      const participants = namesFromNameEntries(data["participants"]);
      if (participants.length === 0) continue;
      const messages: { sender: string; timestampMs: number }[] = [];
      const rawMessages = data["messages"];
      if (Array.isArray(rawMessages)) {
        for (const msg of rawMessages) {
          if (!isRecord(msg)) continue;
          const sender = asString(msg["sender_name"]);
          if (sender === undefined) continue;
          messages.push({ sender, timestampMs: asNumber(msg["timestamp_ms"]) ?? 0 });
        }
      }
      const title = asString(data["title"]);
      const threadPath = asString(data["thread_path"]);
      rawThreads.push({
        participants,
        messages,
        ...(title !== undefined ? { title } : {}),
        ...(threadPath !== undefined ? { threadPath } : {}),
      });
    }
  }

  // --- Owner: the sole participant common to every thread. Fallback: the
  // most frequent thread participant (ties broken alphabetically); with no
  // threads at all, "Unknown Owner".
  let ownerName = "Unknown Owner";
  if (rawThreads.length > 0) {
    const first = rawThreads[0];
    if (first !== undefined) {
      let common = new Set<string>(first.participants);
      for (const thread of rawThreads.slice(1)) {
        common = new Set([...common].filter((n) => thread.participants.includes(n)));
      }
      if (common.size === 1) {
        ownerName = [...common][0] ?? ownerName;
      } else {
        const appearance = new Map<string, number>();
        for (const thread of rawThreads) {
          for (const name of new Set(thread.participants)) {
            appearance.set(name, (appearance.get(name) ?? 0) + 1);
          }
        }
        const ranked = [...appearance.entries()].sort((a, b) =>
          b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1,
        );
        ownerName = ranked[0]?.[0] ?? ownerName;
      }
    }
  }

  // --- People: union of the friends list and thread participants,
  // excluding the owner.
  const personNames = new Map<string, string>(); // id -> name
  const addPerson = (name: string): void => {
    if (name === ownerName) return;
    const id = personIdForName(name);
    if (!personNames.has(id)) personNames.set(id, name);
  };
  for (const name of friendNames) addPerson(name);
  for (const thread of rawThreads) {
    for (const name of thread.participants) addPerson(name);
  }

  // --- messageCount (exact rule, also documented in README):
  // 1:1 thread (exactly 2 participants incl. owner): the thread's total
  // message count goes to the other person. Group thread (>2): each
  // person is credited only with the messages they themselves sent.
  const messageCounts = new Map<string, number>();
  for (const id of personNames.keys()) messageCounts.set(id, 0);
  for (const thread of rawThreads) {
    const nonOwner = thread.participants.filter((n) => n !== ownerName);
    if (thread.participants.length === 2 && nonOwner.length === 1) {
      const other = nonOwner[0];
      if (other !== undefined) {
        const id = personIdForName(other);
        messageCounts.set(id, (messageCounts.get(id) ?? 0) + thread.messages.length);
      }
    } else if (thread.participants.length > 2) {
      for (const msg of thread.messages) {
        if (msg.sender === ownerName) continue;
        const id = personIdForName(msg.sender);
        if (messageCounts.has(id)) {
          messageCounts.set(id, (messageCounts.get(id) ?? 0) + 1);
        }
      }
    }
  }

  // --- Ring inference, in precedence order.
  const listRingById = new Map<string, RingType>();
  for (const list of friendLists) {
    const ring = ringForListName(list.name);
    if (ring === undefined) continue;
    for (const member of list.members) {
      if (member === ownerName) continue;
      const id = personIdForName(member);
      if (!personNames.has(id)) continue;
      const existing = listRingById.get(id);
      listRingById.set(id, existing === undefined ? ring : mostRestrictive(existing, ring));
    }
  }

  const overrideById = new Map<string, RingType>();
  for (const override of overrides ?? []) {
    overrideById.set(override.personId, override.ring);
  }

  const people: NormalizedPerson[] = [];
  const ringById = new Map<string, RingType>();
  for (const [id, name] of personNames) {
    const messageCount = messageCounts.get(id) ?? 0;
    let ring: RingType;
    let ringSource: RingSource;
    const overrideRing = overrideById.get(id);
    const listRing = listRingById.get(id);
    if (overrideRing !== undefined) {
      ring = overrideRing;
      ringSource = "override";
    } else if (listRing !== undefined) {
      ring = listRing;
      ringSource = "list";
    } else if (messageCount >= MESSAGE_FRIENDS_THRESHOLD) {
      ring = "friends";
      ringSource = "inferred";
    } else {
      // Deny-by-default: an unclassified person lands in the innermost
      // (most restrictive) ring until a human classifies them.
      ring = "family";
      ringSource = "default";
    }
    ringById.set(id, ring);
    people.push({ id, name, ring, ringSource, messageCount });
  }
  people.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // --- Posts: owner's own posts, documented default ring "friends".
  const posts: NormalizedPost[] = rawPosts.map((post, i) => ({
    id: `post:${i + 1}`,
    timestamp: post.timestamp,
    text: post.text,
    ...(post.title !== undefined ? { title: post.title } : {}),
    ring: "friends" as RingType,
  }));

  // --- Media: album name containing "family" -> family, else friends.
  const media: NormalizedMedia[] = rawMedia.map((item, i) => ({
    id: `media:${i + 1}`,
    title: item.title,
    ...(item.album !== undefined ? { album: item.album } : {}),
    timestamp: item.timestamp,
    ring: (item.albumName.toLowerCase().includes("family") ? "family" : "friends") as RingType,
  }));

  // --- Threads: ring = most restrictive ring among non-owner
  // participants; a thread with only the owner is "family".
  const threads: NormalizedThread[] = rawThreads.map((thread, i) => {
    const participantIds: string[] = [];
    for (const name of thread.participants) {
      if (name === ownerName) continue;
      const id = personIdForName(name);
      if (!participantIds.includes(id)) participantIds.push(id);
    }
    let ring: RingType = "family";
    if (participantIds.length > 0) {
      ring = participantIds
        .map((id) => ringById.get(id) ?? ("family" as RingType))
        .reduce((acc, r) => mostRestrictive(acc, r));
    }
    const lastMs = thread.messages.reduce((max, m) => Math.max(max, m.timestampMs), 0);
    const pathSlug =
      thread.threadPath !== undefined
        ? slugify(thread.threadPath.split("/").pop() ?? "")
        : "";
    const slug =
      pathSlug.length > 0
        ? pathSlug
        : thread.title !== undefined
          ? slugify(thread.title)
          : `thread-${i + 1}`;
    return {
      id: `thread:${slug}`,
      ...(thread.title !== undefined ? { title: thread.title } : {}),
      participantIds,
      messageCount: thread.messages.length,
      lastTimestamp: Math.floor(lastMs / 1000),
      ring,
    };
  });
  threads.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // --- Summary
  const peoplePerRing: RingCounts = { family: 0, friends: 0, work: 0, public: 0 };
  let unclassifiedCount = 0;
  for (const person of people) {
    peoplePerRing[person.ring] += 1;
    if (person.ringSource === "default") unclassifiedCount += 1;
  }

  return {
    ownerName,
    synthetic,
    people,
    posts,
    media,
    threads,
    summary: {
      peoplePerRing,
      postCount: posts.length,
      mediaCount: media.length,
      threadCount: threads.length,
      unclassifiedCount,
    },
  };
}
