/**
 * @omega/meta-export — shared slug helper (internal)
 *
 * Creator: David Charles Bourassa
 */

/**
 * Slugify a display name: lowercase, every run of non-alphanumeric
 * characters becomes a single "-", leading/trailing "-" trimmed.
 * "Ada Whitfield" -> "ada-whitfield".
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Canonical person id for a display name: "person:" + slug. */
export function personIdForName(name: string): string {
  return `person:${slugify(name)}`;
}
