/**
 * @omega/mcp-gateway — flow-control primitives (pure, browser-safe)
 *
 * RateLimiter (token bucket) and CircuitBreaker. These classes have
 * no imports at all — no node: builtins, no other modules — so browser
 * consumers can use them via the "./browser" subpath without pulling
 * in node:crypto (which lives in infra.ts alongside the PKCE helpers
 * and TokenVault).
 *
 * Creator: David Charles Bourassa
 */

// ---------------------------------------------------------------------------
// RateLimiter — token bucket per key
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export class RateLimiter {
  readonly #capacity: number;
  readonly #refillPerSecond: number;
  readonly #now: () => number;
  readonly #buckets = new Map<string, Bucket>();

  constructor(options: RateLimiterOptions) {
    if (!(options.capacity > 0)) throw new Error("RateLimiter capacity must be > 0");
    if (!(options.refillPerSecond >= 0)) throw new Error("RateLimiter refillPerSecond must be >= 0");
    this.#capacity = options.capacity;
    this.#refillPerSecond = options.refillPerSecond;
    this.#now = options.now ?? (() => Date.now());
  }

  #currentTokens(key: string): { bucket: Bucket; tokens: number } {
    const nowMs = this.#now();
    let bucket = this.#buckets.get(key);
    if (bucket === undefined) {
      bucket = { tokens: this.#capacity, lastRefillMs: nowMs };
      this.#buckets.set(key, bucket);
      return { bucket, tokens: bucket.tokens };
    }
    const elapsedSeconds = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
    const refilled = Math.min(this.#capacity, bucket.tokens + elapsedSeconds * this.#refillPerSecond);
    bucket.tokens = refilled;
    bucket.lastRefillMs = nowMs;
    return { bucket, tokens: refilled };
  }

  /** Consume one token for `key` if available. */
  tryAcquire(key: string): boolean {
    const { bucket, tokens } = this.#currentTokens(key);
    if (tokens >= 1) {
      bucket.tokens = tokens - 1;
      return true;
    }
    return false;
  }

  /** Current token count for `key` without consuming. */
  peek(key: string): number {
    return this.#currentTokens(key).tokens;
  }
}

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

export class CircuitOpenError extends Error {
  constructor(message = "Circuit breaker is open") {
    super(message);
    this.name = "CircuitOpenError";
  }
}

export type CircuitBreakerState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  now?: () => number;
}

export class CircuitBreaker {
  readonly #failureThreshold: number;
  readonly #resetTimeoutMs: number;
  readonly #now: () => number;
  #failureCount = 0;
  #openedAtMs: number | null = null;
  #internalState: "closed" | "open" = "closed";

  constructor(options: CircuitBreakerOptions) {
    if (!(options.failureThreshold >= 1)) throw new Error("CircuitBreaker failureThreshold must be >= 1");
    if (!(options.resetTimeoutMs >= 0)) throw new Error("CircuitBreaker resetTimeoutMs must be >= 0");
    this.#failureThreshold = options.failureThreshold;
    this.#resetTimeoutMs = options.resetTimeoutMs;
    this.#now = options.now ?? (() => Date.now());
  }

  get state(): CircuitBreakerState {
    if (this.#internalState === "open") {
      if (this.#openedAtMs !== null && this.#now() - this.#openedAtMs >= this.#resetTimeoutMs) {
        return "half-open";
      }
      return "open";
    }
    return "closed";
  }

  get failureCount(): number {
    return this.#failureCount;
  }

  async exec<T>(fn: () => Promise<T> | T): Promise<T> {
    const current = this.state;
    if (current === "open") {
      throw new CircuitOpenError();
    }
    // "closed" or "half-open" trial: run the function.
    try {
      const result = await fn();
      // Success closes / resets.
      this.#failureCount = 0;
      this.#internalState = "closed";
      this.#openedAtMs = null;
      return result;
    } catch (err) {
      this.#failureCount += 1;
      if (current === "half-open" || this.#failureCount >= this.#failureThreshold) {
        this.#internalState = "open";
        this.#openedAtMs = this.#now();
      }
      throw err;
    }
  }
}
