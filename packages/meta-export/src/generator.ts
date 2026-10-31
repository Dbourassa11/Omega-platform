/**
 * @omega/meta-export — synthetic Facebook DYI fixture generator
 *
 * All data is fully fictional: a made-up owner and made-up people with
 * mundane, templated content. No real personal data is produced.
 * Output is deterministic for a given seed (default 42): the same seed
 * always yields byte-identical files. The seeded PRNG varies only
 * message wording and timestamp jitter — people, lists, thread
 * message counts, posts, and albums are fixed by design so the
 * parsed summary is stable across seeds.
 *
 * Creator: David Charles Bourassa
 */

import { mulberry32 } from "./prng.js";
import { slugify } from "./slug.js";
import type { ExportFileEntry } from "./types.js";

export const SYNTHETIC_EXPORT_OWNER_NAME = "Ada Whitfield";

const OWNER = SYNTHETIC_EXPORT_OWNER_NAME;

/** The ~28 fictional people in the fixture, in a fixed order. */
const PEOPLE: readonly string[] = [
  "Ben Whitfield",
  "June Whitfield",
  "Tom Whitfield",
  "Nora Whitfield",
  "Sam Delgado",
  "Priya Nair",
  "Leo Park",
  "Mia Santos",
  "Owen Carter",
  "Ella Brooks",
  "Noah Reed",
  "Zara Khan",
  "Finn Murphy",
  "Ivy Chen",
  "Hugo Alvarez",
  "Ruby Thompson",
  "Eli Morgan",
  "Grace Liu",
  "Max Fischer",
  "Luna Reyes",
  "Jack Donovan",
  "Sofia Marino",
  "Adam Kowalski",
  "Maya Patel",
  "Chris Bennett",
  "Ana Silva",
  "Paul Novak",
  "Kate Sullivan",
] as const;

/**
 * Friend-list membership, deliberately overlapping the friends list:
 * Ben Whitfield is on both "Family" and "Close Friends" (family wins,
 * most restrictive), Leo Park is on both "Close Friends" and
 * "Work Colleagues" (friends wins), and Priya Nair is on both
 * "Close Friends" and "Acquaintances" (friends wins).
 */
const FRIEND_LISTS: readonly { name: string; members: readonly string[] }[] =
  [
    {
      name: "Family",
      members: ["Ben Whitfield", "June Whitfield", "Tom Whitfield", "Nora Whitfield"],
    },
    {
      name: "Close Friends",
      members: ["Sam Delgado", "Priya Nair", "Leo Park", "Mia Santos", "Ben Whitfield"],
    },
    {
      name: "Work Colleagues",
      members: ["Owen Carter", "Ella Brooks", "Noah Reed", "Zara Khan", "Leo Park"],
    },
    {
      name: "Acquaintances",
      members: ["Finn Murphy", "Ivy Chen", "Hugo Alvarez", "Priya Nair"],
    },
  ] as const;

const POSTS: readonly { title: string; post: string }[] = [
  { title: "Ada Whitfield updated her status.", post: "Finished a long walk by the river this morning. The light on the water was worth getting up early for." },
  { title: "Ada Whitfield updated her status.", post: "Baked a lemon loaf today. It came out a little too brown on top, but the middle is perfect." },
  { title: "Ada Whitfield updated her status.", post: "Started a new puzzle last night. Two hundred pieces in and I already know I will lose one under the sofa." },
  { title: "Ada Whitfield updated her status.", post: "The garden tomatoes are finally coming in. Three ripe ones today, and the rest are close behind." },
  { title: "Ada Whitfield updated her status.", post: "Read a whole chapter on the train and missed my stop by exactly one station. Worth it." },
  { title: "Ada Whitfield updated her status.", post: "Rainy afternoon, hot tea, and a film I have been meaning to watch for months. Good combination." },
  { title: "Ada Whitfield updated her status.", post: "Took the long way home through the park and found a book sale I did not know was happening." },
  { title: "Ada Whitfield updated her status.", post: "Tried a new recipe for vegetable soup. It needs more salt, but the bread I made with it saved the meal." },
  { title: "Ada Whitfield updated her status.", post: "Morning run done before breakfast. Slow, but done, and that counts." },
  { title: "Ada Whitfield updated her status.", post: "Sorted the old photo boxes today. Found one of us at the lake, sunburned and laughing." },
  { title: "Ada Whitfield updated her status.", post: "The market had the good apples today, so tonight is apple crumble night." },
  { title: "Ada Whitfield updated her status.", post: "Fixed the wobbly kitchen chair with a shim and a bit of glue. Small repair, big satisfaction." },
  { title: "Ada Whitfield updated her status.", post: "Watched the sunset from the hill behind the house. The sky turned the exact colour of the jam I made yesterday." },
  { title: "Ada Whitfield updated her status.", post: "Finished the book I started last month. The last chapter made the slow middle completely worth it." },
] as const;

const ALBUMS: readonly {
  name: string;
  photos: readonly string[];
}[] = [
  {
    name: "Family Picnic 2024",
    photos: ["Picnic table", "Lakeside blanket", "Grill smoke", "Evening walk home"],
  },
  {
    name: "Garden Days",
    photos: ["First tomatoes", "Watering cans", "Sunset over the beds"],
  },
  {
    name: "City Walks",
    photos: ["Old bookshop", "Corner cafe", "Bridge at dusk"],
  },
] as const;

/** Short, mundane, fictional message lines, picked by the seeded PRNG. */
const MESSAGE_TEMPLATES: readonly string[] = [
  "That sounds good to me.",
  "Thanks for sending that over.",
  "Can we talk about this tomorrow?",
  "I finally got around to reading that.",
  "What time works for you this week?",
  "That made me laugh out loud.",
  "Let me check my calendar and get back to you.",
  "I agree, let us keep it simple.",
  "Did you see the weather for the weekend?",
  "Sounds like a plan to me.",
  "I will bring the snacks this time.",
  "Good news on my end today.",
  "Let us pick a day that works for everyone.",
  "I am running a few minutes late, sorry.",
  "That is a lovely idea.",
  "I will send you the photos later tonight.",
] as const;

interface ThreadSpec {
  slug: string;
  title: string;
  /** Participants including the owner, owner first. */
  participants: readonly string[];
  /** Exact sent-message count per sender, in participant order. */
  counts: readonly (readonly [string, number])[];
}

const THREADS: readonly ThreadSpec[] = [
  {
    slug: "ruby-thompson",
    title: "Ruby Thompson",
    participants: [OWNER, "Ruby Thompson"],
    counts: [["Ruby Thompson", 17], [OWNER, 15]],
  },
  {
    slug: "eli-morgan",
    title: "Eli Morgan",
    participants: [OWNER, "Eli Morgan"],
    counts: [["Eli Morgan", 15], [OWNER, 13]],
  },
  {
    slug: "grace-liu",
    title: "Grace Liu",
    participants: [OWNER, "Grace Liu"],
    counts: [["Grace Liu", 7], [OWNER, 5]],
  },
  {
    slug: "max-fischer",
    title: "Max Fischer",
    participants: [OWNER, "Max Fischer"],
    counts: [["Max Fischer", 4], [OWNER, 2]],
  },
  {
    slug: "luna-reyes",
    title: "Luna Reyes",
    participants: [OWNER, "Luna Reyes"],
    counts: [["Luna Reyes", 1], [OWNER, 1]],
  },
  {
    slug: "jack-donovan",
    title: "Jack Donovan",
    participants: [OWNER, "Jack Donovan"],
    counts: [["Jack Donovan", 1], [OWNER, 0]],
  },
  {
    slug: "ben-whitfield",
    title: "Ben Whitfield",
    participants: [OWNER, "Ben Whitfield"],
    counts: [["Ben Whitfield", 21], [OWNER, 19]],
  },
  {
    slug: "priya-nair",
    title: "Priya Nair",
    participants: [OWNER, "Priya Nair"],
    counts: [["Priya Nair", 8], [OWNER, 7]],
  },
  {
    slug: "weekend-hiking-plan",
    title: "Weekend Hiking Plan",
    participants: [OWNER, "Adam Kowalski", "Maya Patel", "Chris Bennett"],
    counts: [["Adam Kowalski", 4], ["Maya Patel", 3], ["Chris Bennett", 2], [OWNER, 3]],
  },
  {
    slug: "book-club",
    title: "Book Club",
    participants: [OWNER, "Ana Silva", "Paul Novak", "Kate Sullivan", "Sam Delgado"],
    counts: [["Ana Silva", 5], ["Paul Novak", 4], ["Kate Sullivan", 3], ["Sam Delgado", 6], [OWNER, 4]],
  },
] as const;

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick from empty list");
  return item;
}

function threadMessages(
  spec: ThreadSpec,
  rng: () => number,
  startMs: number,
): { sender_name: string; timestamp_ms: number; content: string }[] {
  const remaining = new Map<string, number>(spec.counts);
  const messages: { sender_name: string; timestamp_ms: number; content: string }[] = [];
  let ms = startMs;
  // Round-robin through senders in spec order until every count is spent.
  // This keeps each sender's total exactly at its spec count.
  for (;;) {
    let progressed = false;
    for (const [sender, _total] of spec.counts) {
      const left = remaining.get(sender) ?? 0;
      if (left <= 0) continue;
      remaining.set(sender, left - 1);
      progressed = true;
      ms += 300_000 + Math.floor(rng() * 3_600_000);
      messages.push({
        sender_name: sender,
        timestamp_ms: ms,
        content: pick(rng, MESSAGE_TEMPLATES),
      });
    }
    if (!progressed) break;
  }
  return messages;
}

/**
 * Generate a synthetic Facebook DYI-shaped archive for fictional owner
 * "Ada Whitfield" and ~28 fictional people. Deterministic per seed.
 */
export function generateSyntheticExport(seed: number = 42): ExportFileEntry[] {
  const rng = mulberry32(seed);
  const files: ExportFileEntry[] = [];

  // --- friends ---
  const friendBase = 1_577_836_800; // 2020-01-01 UTC, seconds
  files.push({
    path: "friends_and_followers/friends/friends.json",
    content: JSON.stringify(
      {
        friends_v2: PEOPLE.map((name, i) => ({
          name,
          timestamp: friendBase + i * 2_592_000 + Math.floor(rng() * 86_400),
        })),
      },
      null,
      2,
    ),
  });

  // --- friend lists ---
  files.push({
    path: "friends_and_followers/friend_lists/friend_lists.json",
    content: JSON.stringify(
      {
        friend_lists_v2: FRIEND_LISTS.map((list) => ({
          name: list.name,
          members: [...list.members],
        })),
      },
      null,
      2,
    ),
  });

  // --- posts (~14) ---
  const postBase = 1_704_067_200; // 2024-01-01 UTC, seconds
  files.push({
    path: "your_facebook_activity/posts/your_posts_1.json",
    content: JSON.stringify(
      POSTS.map((post, i) => ({
        timestamp: postBase + i * 1_209_600 + Math.floor(rng() * 86_400),
        title: post.title,
        data: [{ post: post.post }],
      })),
      null,
      2,
    ),
  });

  // --- photo albums (album_0 names a "Family" album) ---
  ALBUMS.forEach((album, albumIdx) => {
    files.push({
      path: `your_facebook_activity/posts/album_${albumIdx}.json`,
      content: JSON.stringify(
        {
          name: album.name,
          photos: album.photos.map((title, photoIdx) => ({
            uri: `your_facebook_activity/posts/media/${slugify(album.name)}_${photoIdx + 1}.jpg`,
            creation_timestamp: postBase + albumIdx * 2_592_000 + photoIdx * 86_400,
            title,
          })),
        },
        null,
        2,
      ),
    });
  });

  // --- message threads ---
  THREADS.forEach((spec, threadIdx) => {
    const startMs = 1_704_067_200_000 + threadIdx * 2_592_000_000;
    files.push({
      path: `messages/inbox/${spec.slug}/message_1.json`,
      content: JSON.stringify(
        {
          participants: spec.participants.map((name) => ({ name })),
          messages: threadMessages(spec, rng, startMs),
          title: spec.title,
          thread_path: `messages/inbox/${spec.slug}`,
        },
        null,
        2,
      ),
    });
  });

  // --- synthetic-fixture label file ---
  files.push({
    path: "SYNTHETIC_FIXTURE_README.txt",
    content: [
      "SYNTHETIC FIXTURE — NOT REAL DATA",
      "",
      "This archive is fully synthetic and fictional, generated for the",
      "Omega demo. It contains no real personal data: the owner",
      `"${OWNER}" and every other person, post, photo, and message in`,
      "this archive are invented. Do not treat any name, date, or",
      "message in this archive as belonging to a real person.",
      "",
      "Generated by @omega/meta-export generateSyntheticExport.",
    ].join("\n"),
  });

  return files;
}
