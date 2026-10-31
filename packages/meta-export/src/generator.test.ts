import { describe, expect, it } from "vitest";

import {
  generateSyntheticExport,
  SYNTHETIC_EXPORT_OWNER_NAME,
} from "./generator.js";
import type { ExportFileEntry } from "./types.js";

function byPath(files: readonly ExportFileEntry[], path: string): ExportFileEntry {
  const file = files.find((f) => f.path === path);
  if (file === undefined) throw new Error(`missing fixture file: ${path}`);
  return file;
}

function jsonByPath(files: readonly ExportFileEntry[], path: string): unknown {
  return JSON.parse(byPath(files, path).content) as unknown;
}

describe("generateSyntheticExport — determinism", () => {
  it("produces identical output for the same seed", () => {
    expect(generateSyntheticExport(123)).toEqual(generateSyntheticExport(123));
  });

  it("defaults to seed 42", () => {
    expect(generateSyntheticExport()).toEqual(generateSyntheticExport(42));
  });

  it("produces different output for a different seed", () => {
    expect(generateSyntheticExport(1)).not.toEqual(generateSyntheticExport(2));
  });
});

describe("generateSyntheticExport — files and shapes", () => {
  const files = generateSyntheticExport();

  it("emits the full DYI-shaped file set", () => {
    expect(files.map((f) => f.path)).toEqual([
      "friends_and_followers/friends/friends.json",
      "friends_and_followers/friend_lists/friend_lists.json",
      "your_facebook_activity/posts/your_posts_1.json",
      "your_facebook_activity/posts/album_0.json",
      "your_facebook_activity/posts/album_1.json",
      "your_facebook_activity/posts/album_2.json",
      "messages/inbox/ruby-thompson/message_1.json",
      "messages/inbox/eli-morgan/message_1.json",
      "messages/inbox/grace-liu/message_1.json",
      "messages/inbox/max-fischer/message_1.json",
      "messages/inbox/luna-reyes/message_1.json",
      "messages/inbox/jack-donovan/message_1.json",
      "messages/inbox/ben-whitfield/message_1.json",
      "messages/inbox/priya-nair/message_1.json",
      "messages/inbox/weekend-hiking-plan/message_1.json",
      "messages/inbox/book-club/message_1.json",
      "SYNTHETIC_FIXTURE_README.txt",
    ]);
  });

  it("names the fictional owner", () => {
    expect(SYNTHETIC_EXPORT_OWNER_NAME).toBe("Ada Whitfield");
  });

  it("friends.json has friends_v2 with 28 named, timestamped people", () => {
    const data = jsonByPath(files, "friends_and_followers/friends/friends.json") as {
      friends_v2: { name: string; timestamp: number }[];
    };
    expect(data.friends_v2).toHaveLength(28);
    for (const friend of data.friends_v2) {
      expect(typeof friend.name).toBe("string");
      expect(friend.name.length).toBeGreaterThan(0);
      expect(typeof friend.timestamp).toBe("number");
    }
  });

  it("friend_lists.json has the four expected lists with members", () => {
    const data = jsonByPath(
      files,
      "friends_and_followers/friend_lists/friend_lists.json",
    ) as { friend_lists_v2: { name: string; members: string[] }[] };
    expect(data.friend_lists_v2.map((l) => l.name)).toEqual([
      "Family",
      "Close Friends",
      "Work Colleagues",
      "Acquaintances",
    ]);
    for (const list of data.friend_lists_v2) {
      expect(list.members.length).toBeGreaterThan(0);
    }
  });

  it("posts file is an array of ~14 DYI post entries", () => {
    const data = jsonByPath(
      files,
      "your_facebook_activity/posts/your_posts_1.json",
    ) as { timestamp: number; title: string; data: { post: string }[] }[];
    expect(data).toHaveLength(14);
    for (const post of data) {
      expect(typeof post.timestamp).toBe("number");
      expect(post.data[0]?.post.length).toBeGreaterThan(0);
    }
  });

  it("albums are DYI-shaped and one album names Family", () => {
    const names: string[] = [];
    for (const idx of [0, 1, 2]) {
      const data = jsonByPath(
        files,
        `your_facebook_activity/posts/album_${idx}.json`,
      ) as { name: string; photos: { uri: string; creation_timestamp: number; title: string }[] };
      names.push(data.name);
      expect(data.photos.length).toBeGreaterThan(0);
      for (const photo of data.photos) {
        expect(typeof photo.uri).toBe("string");
        expect(typeof photo.creation_timestamp).toBe("number");
        expect(typeof photo.title).toBe("string");
      }
    }
    expect(names.some((n) => n.includes("Family"))).toBe(true);
  });

  it("message threads are DYI-shaped, with 1:1 and group threads", () => {
    const threadFiles = files.filter((f) => f.path.startsWith("messages/inbox/"));
    expect(threadFiles).toHaveLength(10);
    let sawGroup = false;
    let sawOneToOne = false;
    for (const file of threadFiles) {
      const data = JSON.parse(file.content) as {
        participants: { name: string }[];
        messages: { sender_name: string; timestamp_ms: number; content: string }[];
        title: string;
        thread_path: string;
      };
      expect(data.participants.length).toBeGreaterThanOrEqual(2);
      expect(data.messages.length).toBeGreaterThan(0);
      expect(typeof data.title).toBe("string");
      expect(typeof data.thread_path).toBe("string");
      if (data.participants.length === 2) sawOneToOne = true;
      if (data.participants.length >= 3) sawGroup = true;
    }
    expect(sawOneToOne).toBe(true);
    expect(sawGroup).toBe(true);
  });

  it("readme labels the archive synthetic and fictional", () => {
    const readme = byPath(files, "SYNTHETIC_FIXTURE_README.txt");
    expect(readme.content.toLowerCase()).toContain("synthetic");
    expect(readme.content.toLowerCase()).toContain("fictional");
    expect(readme.content.toLowerCase()).toContain("no real personal data");
  });
});
