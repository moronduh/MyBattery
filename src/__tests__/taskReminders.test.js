import { describe, it, expect } from "vitest";
import { buildTaskNotifs, TASK_REMINDER_DEFAULTS } from "../taskReminders.js";

const now = new Date(2026, 9, 20, 10, 0, 0); // Oct 20 2026, 10:00
const prefs = { ...TASK_REMINDER_DEFAULTS };
const task = (o) => ({ id: "t", name: "Call dentist", done: false, dueDate: null, reminderTime: null, ...o });

describe("buildTaskNotifs", () => {
  it("returns nothing when task reminders are switched off", () => {
    expect(buildTaskNotifs([task({ dueDate: "2026-10-22", reminderTime: "14:00" })], { ...prefs, enabled: false }, now)).toEqual([]);
  });

  it("schedules a due date + time once, and skips it when already past", () => {
    const [n] = buildTaskNotifs([task({ dueDate: "2026-10-22", reminderTime: "14:30" })], prefs, now);
    expect(n.schedule.at).toEqual(new Date(2026, 9, 22, 14, 30));
    expect(n.schedule.repeats).toBeUndefined();
    expect(buildTaskNotifs([task({ dueDate: "2026-10-20", reminderTime: "09:00" })], prefs, now)).toEqual([]);
  });

  it("repeats daily for a time with no due date", () => {
    const [n] = buildTaskNotifs([task({ reminderTime: "08:15" })], prefs, now);
    expect(n.schedule).toMatchObject({ on: { hour: 8, minute: 15 }, repeats: true });
  });

  it("sends one morning note for a due date with no time", () => {
    const [n] = buildTaskNotifs([task({ dueDate: "2026-10-21" })], { ...prefs, dueMorningTime: "07:45" }, now);
    expect(n.body).toBe("Due today: Call dentist");
    expect(n.schedule.at).toEqual(new Date(2026, 9, 21, 7, 45));
  });

  it("groups several tasks due the same day into one note", () => {
    const out = buildTaskNotifs([task({ dueDate: "2026-10-21" }), task({ name: "Pay rent", dueDate: "2026-10-21" })], prefs, now);
    expect(out).toHaveLength(1);
    expect(out[0].body).toContain("2 things are due today");
  });

  it("skips done tasks, past mornings and dates beyond the horizon", () => {
    const out = buildTaskNotifs([
      task({ dueDate: "2026-10-22", done: true }),
      task({ dueDate: "2026-10-20" }),        // 09:00 already passed today
      task({ dueDate: "2027-03-01" }),
    ], prefs, now);
    expect(out).toEqual([]);
  });

  it("assigns sequential ids from idBase and respects max", () => {
    const out = buildTaskNotifs([task({ reminderTime: "08:00" }), task({ reminderTime: "09:00" }), task({ reminderTime: "10:00" })], prefs, now, { idBase: 100, max: 2 });
    expect(out.map(n => n.id)).toEqual([100, 101]);
  });
});
