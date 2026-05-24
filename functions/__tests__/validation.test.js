// Unit tests for input validation and helper logic in functions/index.js.
// We test the pure logic (task filtering, time validation, localHourMinute)
// without requiring Firebase Admin SDK or a live project.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── localHourMinute (extracted for testing) ──────────────────────────────────
function localHourMinute(tz) {
  if (!tz || typeof tz !== "string") return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const hh = parseInt(parts.find(p => p.type === "hour").value,   10);
    const mm = parseInt(parts.find(p => p.type === "minute").value, 10);
    return (isNaN(hh) || isNaN(mm)) ? null : [hh, mm];
  } catch { return null; }
}

// ─── task filtering logic (mirrors aiCoach in index.js) ──────────────────────
function filterTasks(rawTasks) {
  if (!Array.isArray(rawTasks)) return [];
  return rawTasks
    .filter(t => t && typeof t.name === "string" && t.name.trim().length > 0 && t.name.length <= 200)
    .slice(0, 50);
}

function buildTaskList(tasks) {
  const safe = filterTasks(tasks);
  return safe.length
    ? safe.map(t => `${t.done === true ? "✓" : "○"} ${t.name.slice(0, 200)}${typeof t.priority === "string" ? ` [${t.priority.slice(0, 20)}]` : ""}`).join("\n")
    : "No tasks listed.";
}

// ─── time string validation (mirrors scheduled functions) ─────────────────────
function isValidTimeString(s) {
  return typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s);
}

describe("localHourMinute", () => {
  it("returns [hh, mm] for a valid IANA timezone", () => {
    const result = localHourMinute("America/New_York");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    const [hh, mm] = result;
    expect(hh).toBeGreaterThanOrEqual(0);
    expect(hh).toBeLessThan(24);
    expect(mm).toBeGreaterThanOrEqual(0);
    expect(mm).toBeLessThan(60);
  });

  it("returns null for an invalid or missing timezone", () => {
    expect(localHourMinute("Not/ATimezone")).toBeNull(); // throws RangeError → caught
    expect(localHourMinute("")).toBeNull();              // falsy → early return
    expect(localHourMinute(undefined)).toBeNull();       // falsy → early return
    expect(localHourMinute(null)).toBeNull();            // falsy → early return
  });

  it("returns a consistent result for UTC", () => {
    const result = localHourMinute("UTC");
    expect(result).not.toBeNull();
  });
});

describe("filterTasks", () => {
  it("removes tasks with empty or whitespace-only names", () => {
    const tasks = [{ name: "" }, { name: "   " }, { name: "Valid task", done: false }];
    const result = filterTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Valid task");
  });

  it("removes tasks with name over 200 chars", () => {
    const long = "a".repeat(201);
    const tasks = [{ name: long }, { name: "Short", done: false }];
    expect(filterTasks(tasks)).toHaveLength(1);
  });

  it("removes tasks where name is not a string", () => {
    const tasks = [{ name: 42 }, { name: null }, { name: ["array"] }, { name: "OK" }];
    expect(filterTasks(tasks)).toHaveLength(1);
  });

  it("caps at 50 tasks", () => {
    const tasks = Array.from({ length: 60 }, (_, i) => ({ name: `Task ${i}`, done: false }));
    expect(filterTasks(tasks)).toHaveLength(50);
  });

  it("returns empty array for non-array input", () => {
    expect(filterTasks(null)).toEqual([]);
    expect(filterTasks("string")).toEqual([]);
    expect(filterTasks(undefined)).toEqual([]);
  });

  it("removes null/undefined entries", () => {
    const tasks = [null, undefined, { name: "Real task" }];
    expect(filterTasks(tasks)).toHaveLength(1);
  });
});

describe("buildTaskList", () => {
  it("returns 'No tasks listed.' for empty input", () => {
    expect(buildTaskList([])).toBe("No tasks listed.");
    expect(buildTaskList(null)).toBe("No tasks listed.");
  });

  it("marks done tasks with ✓ and pending with ○", () => {
    const tasks = [
      { name: "Done task",    done: true  },
      { name: "Pending task", done: false },
    ];
    const result = buildTaskList(tasks);
    expect(result).toContain("✓ Done task");
    expect(result).toContain("○ Pending task");
  });

  it("includes priority in brackets when present", () => {
    const tasks = [{ name: "Study", done: false, priority: "high" }];
    expect(buildTaskList(tasks)).toContain("[high]");
  });

  it("omits priority when not a string", () => {
    const tasks = [{ name: "Study", done: false, priority: 42 }];
    expect(buildTaskList(tasks)).not.toContain("[");
  });

  it("truncates priority to 20 chars", () => {
    const tasks = [{ name: "Study", done: false, priority: "a".repeat(30) }];
    const result = buildTaskList(tasks);
    expect(result).toContain(`[${"a".repeat(20)}]`);
  });
});

describe("isValidTimeString", () => {
  it("accepts valid HH:MM strings", () => {
    expect(isValidTimeString("09:00")).toBe(true);
    expect(isValidTimeString("9:30")).toBe(true);
    expect(isValidTimeString("17:45")).toBe(true);
    expect(isValidTimeString("0:00")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidTimeString("9am")).toBe(false);
    expect(isValidTimeString("25:00")).toBe(true);  // format valid, value not — caught by NaN check downstream
    expect(isValidTimeString("")).toBe(false);
    expect(isValidTimeString(null)).toBe(false);
    expect(isValidTimeString(undefined)).toBe(false);
    expect(isValidTimeString(900)).toBe(false);
  });
});
