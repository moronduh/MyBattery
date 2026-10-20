import { describe, it, expect } from "vitest";
import { isProGrantActive } from "../proGrant.js";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const ts = iso => ({ toMillis: () => Date.parse(iso) }); // shape of a Firestore Timestamp

describe("isProGrantActive", () => {
  it("is false when there is no grant", () => {
    expect(isProGrantActive(undefined, NOW)).toBe(false);
    expect(isProGrantActive(null, NOW)).toBe(false);
    expect(isProGrantActive({}, NOW)).toBe(false);
  });

  it("requires pro to be exactly true", () => {
    expect(isProGrantActive({ pro: false }, NOW)).toBe(false);
    expect(isProGrantActive({ pro: "true" }, NOW)).toBe(false);
    expect(isProGrantActive({ pro: 1 }, NOW)).toBe(false);
  });

  it("grants with no expiry", () => {
    expect(isProGrantActive({ pro: true }, NOW)).toBe(true);
  });

  it("honors a Firestore Timestamp expiry", () => {
    expect(isProGrantActive({ pro: true, until: ts("2026-12-01T00:00:00Z") }, NOW)).toBe(true);
    expect(isProGrantActive({ pro: true, until: ts("2026-10-01T00:00:00Z") }, NOW)).toBe(false);
  });

  it("honors an ISO string expiry", () => {
    expect(isProGrantActive({ pro: true, until: "2026-12-01" }, NOW)).toBe(true);
    expect(isProGrantActive({ pro: true, until: "2026-10-01" }, NOW)).toBe(false);
  });

  it("treats an unparseable expiry as expired rather than granting forever", () => {
    expect(isProGrantActive({ pro: true, until: "not a date" }, NOW)).toBe(false);
  });
});
