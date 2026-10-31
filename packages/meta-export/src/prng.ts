/**
 * @omega/meta-export — deterministic PRNG (internal)
 *
 * Creator: David Charles Bourassa
 */

/**
 * Standard mulberry32 pseudo-random generator.
 * Returns a function producing values in [0, 1), deterministic from `seed`.
 * Implemented locally so this package depends on @omega/cosmos-engine
 * for types only.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
