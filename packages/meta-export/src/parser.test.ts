import { describe, expect, it } from "vitest";

import { generateSyntheticExport } from "./generator.js";
import { parseFacebookExport } from "./parser.js";
import type { NormalizedPerson } from "./types.js";

const graph = parseFacebookExport(generateSyntheticExport());

function person(id: string): NormalizedPerson {
  const found = graph.people.find((p) => p.id === id);
  if (found === undefined) throw new Error(`missing person: ${id}`);
  return found;
}

describe("parseFacebookExport — synthetic fixture summary", () => {
  it("identifies the fictional owner and the synthetic flag", () => {
    expect(graph.ownerName).toBe("Ada Whitfield");
    expect(graph.synthetic).toBe(true);
  });

  it("produces the expected totals", () => {
    expect(graph.people).toHaveLength(28);
    expect(graph.summary).toEqual({
      peoplePerRing: { family: 15, friends: 6, work: 4, public: 3 },
      postCount: 14,
      mediaCount: 10,
      threadCount: 10,
      unclassifiedCount: 11,
    });
  });

  it("sorts people deterministically by id", () => {
    const ids = graph.people.map((p) => p.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("excludes the owner from people", () => {
    expect(graph.people.some((p) => p.name === graph.ownerName)).toBe(false);
  });
});

describe("parseFacebookExport — ring inference precedence", () => {
  it("a Family-list person is family / list", () => {
    const ben = person("person:ben-whitfield");
    expect(ben.ring).toBe("family");
    expect(ben.ringSource).toBe("list");
  });

  it("most restrictive list wins for overlapping memberships", () => {
    // Ben is also on Close Friends; Leo is on Close Friends + Work
    // Colleagues; Priya is on Close Friends + Acquaintances.
    expect(person("person:ben-whitfield").ring).toBe("family");
    expect(person("person:leo-park").ring).toBe("friends");
    expect(person("person:leo-park").ringSource).toBe("list");
    expect(person("person:priya-nair").ring).toBe("friends");
    expect(person("person:priya-nair").ringSource).toBe("list");
  });

  it("work and acquaintance lists map to work / list and public / list", () => {
    expect(person("person:owen-carter").ring).toBe("work");
    expect(person("person:owen-carter").ringSource).toBe("list");
    expect(person("person:finn-murphy").ring).toBe("public");
    expect(person("person:finn-murphy").ringSource).toBe("list");
  });

  it("an unlisted person with >= 25 messages is friends / inferred", () => {
    const ruby = person("person:ruby-thompson");
    expect(ruby.messageCount).toBe(32);
    expect(ruby.ring).toBe("friends");
    expect(ruby.ringSource).toBe("inferred");
  });

  it("a 1-message unlisted person is family / default (deny-by-default)", () => {
    const jack = person("person:jack-donovan");
    expect(jack.messageCount).toBe(1);
    expect(jack.ring).toBe("family");
    expect(jack.ringSource).toBe("default");
    expect(graph.summary.unclassifiedCount).toBeGreaterThanOrEqual(1);
  });

  it("a list classification beats message-frequency inference", () => {
    // Ben has 40 messages (>= 25) but his Family list must win.
    const ben = person("person:ben-whitfield");
    expect(ben.messageCount).toBe(40);
    expect(ben.ringSource).toBe("list");
  });

  it("an override beats a list classification", () => {
    const overridden = parseFacebookExport(generateSyntheticExport(), [
      { personId: "person:ben-whitfield", ring: "public" },
    ]);
    const ben = overridden.people.find((p) => p.id === "person:ben-whitfield");
    expect(ben?.ring).toBe("public");
    expect(ben?.ringSource).toBe("override");
    expect(overridden.summary.peoplePerRing.public).toBe(4);
    expect(overridden.summary.peoplePerRing.family).toBe(14);
  });
});

describe("parseFacebookExport — messageCount rule", () => {
  it("1:1 threads credit the thread total to the other person", () => {
    expect(person("person:eli-morgan").messageCount).toBe(28);
    expect(person("person:grace-liu").messageCount).toBe(12);
  });

  it("group threads credit each person only with messages they sent", () => {
    expect(person("person:adam-kowalski").messageCount).toBe(4);
    expect(person("person:maya-patel").messageCount).toBe(3);
    expect(person("person:sam-delgado").messageCount).toBe(6);
  });
});

describe("parseFacebookExport — posts, media, threads", () => {
  it("posts default to the friends ring", () => {
    expect(graph.posts).toHaveLength(14);
    for (const post of graph.posts) {
      expect(post.ring).toBe("friends");
      expect(post.text.length).toBeGreaterThan(0);
    }
  });

  it("media in a Family-named album is family, other media is friends", () => {
    const familyMedia = graph.media.filter((m) => m.album?.includes("Family"));
    expect(familyMedia).toHaveLength(4);
    for (const item of familyMedia) expect(item.ring).toBe("family");
    for (const item of graph.media.filter((m) => !m.album?.includes("Family"))) {
      expect(item.ring).toBe("friends");
    }
  });

  it("thread ring is the most restrictive participant ring", () => {
    const benThread = graph.threads.find((t) => t.id === "thread:ben-whitfield");
    expect(benThread?.ring).toBe("family");
    expect(benThread?.messageCount).toBe(40);
    const rubyThread = graph.threads.find((t) => t.id === "thread:ruby-thompson");
    expect(rubyThread?.ring).toBe("friends");
    // Book Club mixes a friends/list member with default (family)
    // members, so the thread itself is family.
    const bookClub = graph.threads.find((t) => t.id === "thread:book-club");
    expect(bookClub?.ring).toBe("family");
    expect(bookClub?.participantIds).toHaveLength(4);
  });
});

describe("parseFacebookExport — robustness", () => {
  it("tolerates a malformed JSON file without throwing", () => {
    const files = [
      ...generateSyntheticExport(),
      { path: "messages/inbox/broken/message_1.json", content: "{ not json" },
      { path: "friends_and_followers/friends/friends.json", content: "[[[" },
    ];
    const parsed = parseFacebookExport(files);
    // The valid fixture still parses; the bad duplicate friends file is
    // skipped (the good copy of the same path still supplies everyone).
    expect(parsed.people).toHaveLength(28);
    expect(parsed.summary.threadCount).toBe(10);
  });

  it("ignores unknown files", () => {
    const withExtras = parseFacebookExport([
      ...generateSyntheticExport(),
      { path: "random/notes.txt", content: "hello" },
      { path: "random/other.json", content: JSON.stringify({ nope: true }) },
    ]);
    expect(withExtras.summary).toEqual(graph.summary);
    expect(withExtras.people).toEqual(graph.people);
  });

  it("tolerates path prefixes on export files", () => {
    const prefixed = generateSyntheticExport().map((f) => ({
      path: `facebook-ada-whitfield/${f.path}`,
      content: f.content,
    }));
    const parsed = parseFacebookExport(prefixed);
    expect(parsed.summary).toEqual(graph.summary);
    expect(parsed.ownerName).toBe("Ada Whitfield");
  });

  it("reports synthetic=false when the fixture readme is absent", () => {
    const withoutReadme = generateSyntheticExport().filter(
      (f) => !f.path.endsWith("SYNTHETIC_FIXTURE_README.txt"),
    );
    expect(parseFacebookExport(withoutReadme).synthetic).toBe(false);
  });

  it("handles an empty export without throwing", () => {
    const empty = parseFacebookExport([]);
    expect(empty.people).toEqual([]);
    expect(empty.summary.postCount).toBe(0);
    expect(empty.summary.threadCount).toBe(0);
  });
});
