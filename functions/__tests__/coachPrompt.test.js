import { describe, it, expect } from "vitest";
import coach from "../coachPrompt.js";

const { normalizeStyle, extractTasks, buildSystemPrompt, parseBrainDump } = coach;

describe("normalizeStyle", () => {
  it("accepts the three styles and defaults everything else", () => {
    expect(normalizeStyle("gentle")).toBe("gentle");
    expect(normalizeStyle("stern")).toBe("stern");
    expect(normalizeStyle("default")).toBe("default");
    expect(normalizeStyle("savage")).toBe("default");
    expect(normalizeStyle(undefined)).toBe("default");
  });
});

describe("buildSystemPrompt", () => {
  const base = { battery: 55, date: "Friday, November 6", taskList: "○ Email landlord" };

  it("uses the tone for the chosen style", () => {
    expect(buildSystemPrompt({ ...base, style: "gentle" })).toContain("Tone: Gentle");
    expect(buildSystemPrompt({ ...base, style: "stern" })).toContain("Tone: Stern");
    expect(buildSystemPrompt({ ...base, style: "nope" })).toContain("Tone: Warm and practical");
  });

  it("always carries the crisis-safety rule, even in stern", () => {
    for (const style of ["gentle", "default", "stern"]) {
      const p = buildSystemPrompt({ ...base, style });
      expect(p).toContain("988");
      expect(p).toContain("do not include a <tasks> block");
    }
  });
});

describe("extractTasks", () => {
  it("returns the visible reply without the tasks block", () => {
    const text = 'Here is a starting point.\n<tasks>{"parent":"Study for exam","items":[{"title":"Outline chapter one","detail":"15 minutes"},{"title":"Make flashcards"}]}</tasks>';
    const out = extractTasks(text);
    expect(out.reply).toBe("Here is a starting point.");
    expect(out.parent).toBe("Study for exam");
    expect(out.tasks).toEqual([{ title: "Outline chapter one", detail: "15 minutes" }, { title: "Make flashcards" }]);
  });

  it("cleans titles, drops duplicates, and caps at 8", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ title: `Task ${i}` }));
    items.unshift({ title: '**Step 1: "Call mom."**' }, { title: "call mom" });
    const out = extractTasks(`ok <tasks>${JSON.stringify({ items })}</tasks>`);
    expect(out.tasks[0].title).toBe("Call mom");
    expect(out.tasks.filter(t => t.title.toLowerCase() === "call mom")).toHaveLength(1);
    expect(out.tasks).toHaveLength(8);
  });

  it("gives no tasks when the JSON is invalid, and still hides the tag", () => {
    const out = extractTasks("Try this. <tasks>{not json</tasks>");
    expect(out.tasks).toEqual([]);
    expect(out.reply).toBe("Try this.");
  });

  it("hides an unclosed tasks tag", () => {
    expect(extractTasks('Hi <tasks>{"items":[').reply).toBe("Hi");
  });

  it("returns nothing for a plain reply or a single item", () => {
    expect(extractTasks("Take a break.").tasks).toEqual([]);
    expect(extractTasks('x <tasks>{"items":[{"title":"Rest"}]}</tasks>').tasks).toEqual([]);
  });

  it("handles a bare array", () => {
    const out = extractTasks('x <tasks>["Pay rent","Book dentist"]</tasks>');
    expect(out.tasks.map(t => t.title)).toEqual(["Pay rent", "Book dentist"]);
    expect(out.parent).toBeNull();
  });
});

describe("parseBrainDump", () => {
  it("parses a JSON array, trims, and de-duplicates", () => {
    expect(parseBrainDump('["Pay rent.", "pay rent", " Book dentist "]')).toEqual(["Pay rent", "Book dentist"]);
  });
  it("returns [] for garbage", () => {
    expect(parseBrainDump("sorry")).toEqual([]);
    expect(parseBrainDump(undefined)).toEqual([]);
  });
});
