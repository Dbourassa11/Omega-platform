/**
 * @omega/meta-export — public type contracts
 *
 * Creator: David Charles Bourassa
 */

import type { RingType } from "@omega/consent-core";
import type { CosmosData } from "@omega/cosmos-engine";

export type { CosmosData, RingType };

/** One file of a Facebook "Download Your Information" export, in memory. */
export interface ExportFileEntry {
  path: string;
  content: string;
}

/** Where a person's ring classification came from, in precedence order. */
export type RingSource = "list" | "inferred" | "default" | "override";

export interface NormalizedPerson {
  id: string;
  name: string;
  ring: RingType;
  ringSource: RingSource;
  messageCount: number;
}

export interface NormalizedPost {
  id: string;
  timestamp: number;
  text: string;
  title?: string;
  ring: RingType;
}

export interface NormalizedMedia {
  id: string;
  title: string;
  album?: string;
  timestamp: number;
  ring: RingType;
}

export interface NormalizedThread {
  id: string;
  title?: string;
  participantIds: string[];
  messageCount: number;
  lastTimestamp: number;
  ring: RingType;
}

export interface RingCounts {
  family: number;
  friends: number;
  work: number;
  public: number;
}

export interface NormalizedMemberGraph {
  ownerName: string;
  synthetic: boolean;
  people: NormalizedPerson[];
  posts: NormalizedPost[];
  media: NormalizedMedia[];
  threads: NormalizedThread[];
  summary: {
    peoplePerRing: RingCounts;
    postCount: number;
    mediaCount: number;
    threadCount: number;
    unclassifiedCount: number;
  };
}

export interface RingOverride {
  personId: string;
  ring: RingType;
}
