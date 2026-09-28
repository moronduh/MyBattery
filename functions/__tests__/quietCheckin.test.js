import { describe, it, expect } from "vitest";
import quiet from "../quietCheckin.js";

const { shouldSendQuietCheckin, toMillis, QUIET_SEND_AT, QUIET_DAYS } = quiet;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 28, 16, 0);
const base = { prefs: {}, local: QUIET_SEND_AT, lastActivityMs: now - (QUIET_DAYS + 1) * DAY, lastNudgeMs: null, nowMs: now };

describe("shouldSendQuietCheckin", () => {
  it("sends after the quiet period at the send time", () => {
    expect(shouldSendQuietCheckin(base)).toBe(true);
  });

  it("does not send before the quiet period is up", () => {
    expect(shouldSendQuietCheckin({ ...base, lastActivityMs: now - (QUIET_DAYS - 1) * DAY })).toBe(false);
  });

  it("only sends at the send time", () => {
    expect(shouldSendQuietCheckin({ ...base, local: [QUIET_SEND_AT[0], QUIET_SEND_AT[1] + 1] })).toBe(false);
    expect(shouldSendQuietCheckin({ ...base, local: null })).toBe(false);
  });

  it("does not send to someone who has never logged", () => {
    expect(shouldSendQuietCheckin({ ...base, lastActivityMs: null })).toBe(false);
  });

  it("sends once per quiet stretch", () => {
    expect(shouldSendQuietCheckin({ ...base, lastNudgeMs: now - DAY })).toBe(false);
  });

  it("can send again after the user logs and goes quiet again", () => {
    expect(shouldSendQuietCheckin({ ...base, lastNudgeMs: base.lastActivityMs - 10 * DAY })).toBe(true);
  });

  it("respects the opt-out", () => {
    expect(shouldSendQuietCheckin({ ...base, prefs: { quietCheckinEnabled: false } })).toBe(false);
    expect(shouldSendQuietCheckin({ ...base, prefs: undefined })).toBe(true);
  });
});

describe("toMillis", () => {
  it("handles Firestore Timestamps, Dates, numbers and null", () => {
    expect(toMillis({ toMillis: () => 5 })).toBe(5);
    expect(toMillis(new Date(7))).toBe(7);
    expect(toMillis(9)).toBe(9);
    expect(toMillis(null)).toBe(null);
    expect(toMillis("x")).toBe(null);
  });
});
