/**
 * @omega/mcp-gateway — infrastructure primitives tests
 *
 * Creator: David Charles Bourassa
 */

import { describe, expect, it } from "vitest";

import {
  CircuitBreaker,
  CircuitOpenError,
  RateLimiter,
  TokenVault,
  generateCodeChallengeS256,
  generateCodeVerifier,
  verifyCodeChallenge,
} from "./infra.js";

describe("RateLimiter", () => {
  it("allows up to capacity, then denies, and peeks without consuming", () => {
    let now = 1_000;
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });
    expect(limiter.peek("u1")).toBe(2);
    expect(limiter.tryAcquire("u1")).toBe(true);
    expect(limiter.peek("u1")).toBe(1);
    expect(limiter.tryAcquire("u1")).toBe(true);
    expect(limiter.tryAcquire("u1")).toBe(false);
    expect(limiter.peek("u1")).toBe(0);
    // Buckets are per-key.
    expect(limiter.tryAcquire("u2")).toBe(true);
    // Refill after 1 second.
    now += 1_000;
    expect(limiter.peek("u1")).toBe(1);
    expect(limiter.tryAcquire("u1")).toBe(true);
    // Refill is capped at capacity.
    now += 10_000;
    expect(limiter.peek("u1")).toBe(2);
  });
});

describe("CircuitBreaker", () => {
  it("stays closed on success and opens after the failure threshold", async () => {
    let now = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5_000, now: () => now });
    expect(breaker.state).toBe("closed");
    await expect(breaker.exec(async () => "ok")).resolves.toBe("ok");
    await expect(
      breaker.exec(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(breaker.state).toBe("closed");
    await expect(
      breaker.exec(async () => {
        throw new Error("boom2");
      }),
    ).rejects.toThrow("boom2");
    expect(breaker.state).toBe("open");
    // Open: fn must not run.
    let ran = false;
    await expect(
      breaker.exec(async () => {
        ran = true;
        return "should not happen";
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(ran).toBe(false);
    // After the reset timeout, a half-open trial is allowed; success closes.
    now += 5_000;
    expect(breaker.state).toBe("half-open");
    await expect(breaker.exec(async () => "recovered")).resolves.toBe("recovered");
    expect(breaker.state).toBe("closed");
    expect(breaker.failureCount).toBe(0);
  });

  it("a failed half-open trial re-opens the breaker", async () => {
    let now = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1_000, now: () => now });
    await expect(
      breaker.exec(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");
    expect(breaker.state).toBe("open");
    now += 1_000;
    expect(breaker.state).toBe("half-open");
    await expect(
      breaker.exec(async () => {
        throw new Error("fail again");
      }),
    ).rejects.toThrow("fail again");
    expect(breaker.state).toBe("open");
  });
});

describe("PKCE", () => {
  it("matches the RFC 7636 Appendix B vector", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    expect(generateCodeChallengeS256(verifier)).toBe(challenge);
    expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
  });

  it("generates verifiers that verify, and rejects a wrong verifier", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    const challenge = generateCodeChallengeS256(verifier);
    expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
    expect(verifyCodeChallenge(generateCodeVerifier(), challenge)).toBe(false);
    expect(verifyCodeChallenge(verifier, "not-the-challenge")).toBe(false);
  });
});

describe("TokenVault", () => {
  it("wraps, unwraps, deletes, and disconnect purges with a descriptor", () => {
    const vault = new TokenVault();
    const wrapped = vault.wrap("user-1", "github", "synthetic-token-123");
    expect(wrapped.ciphertext).toBeTypeOf("string");
    expect(wrapped.ciphertext).not.toBe("synthetic-token-123");
    expect(vault.unwrap("user-1", "github")).toBe("synthetic-token-123");
    expect(vault.has("user-1", "github")).toBe(true);
    expect(vault.delete("user-1", "github")).toBe(true);
    expect(vault.unwrap("user-1", "github")).toBeUndefined();
    expect(vault.delete("user-1", "github")).toBe(false);

    vault.wrap("user-1", "stripe", "sk_test_synthetic");
    const purge = vault.disconnect("stripe", "user-1");
    expect(purge).toEqual({ type: "ai.context.purge", adapterId: "stripe", userId: "user-1" });
    expect(vault.unwrap("user-1", "stripe")).toBeUndefined();
  });

  it("supports host-supplied wrap/unwrap functions", () => {
    const vault = new TokenVault({
      wrapFn: (plain) => `wrapped:${plain.split("").reverse().join("")}`,
      unwrapFn: (cipher) => cipher.replace(/^wrapped:/, "").split("").reverse().join(""),
    });
    const wrapped = vault.wrap("u", "notion", "secret-value");
    expect(wrapped.ciphertext.startsWith("wrapped:")).toBe(true);
    expect(vault.unwrap("u", "notion")).toBe("secret-value");
  });
});
