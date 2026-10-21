// Task reminder settings and the plan for which iOS local notifications to schedule.
// Kept apart from the 11k-line component so the scheduling rules can be unit tested.

export const TASK_REMINDER_PREFS_KEY = "reflow-task-reminders";
export const TASK_REMINDER_PREFS_EVENT = "reflow-task-reminders-changed";
export const TASK_REMINDER_DEFAULTS = { enabled: true, dueMorningTime: "09:00" };

// How far ahead the "due today" nudges are scheduled; iOS keeps at most 64 pending
// notifications per app, so we only plan the near future and re-plan on every task change/launch.
const DUE_NUDGE_HORIZON_DAYS = 30;

export function loadTaskReminderPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(TASK_REMINDER_PREFS_KEY) || "null");
    return { ...TASK_REMINDER_DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch { return { ...TASK_REMINDER_DEFAULTS }; }
}

export function saveTaskReminderPrefs(prefs) {
  try { localStorage.setItem(TASK_REMINDER_PREFS_KEY, JSON.stringify(prefs)); } catch {}
  try { window.dispatchEvent(new CustomEvent(TASK_REMINDER_PREFS_EVENT, { detail: prefs })); } catch {}
}

function parseTime(str) {
  const [hour, minute] = String(str || "").split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? { hour, minute } : null;
}

// Returns Capacitor LocalNotifications payloads (ids start at idBase, at most `max`):
//  - task with a due date + time        → one reminder at that moment
//  - task with a time but no due date   → daily reminder at that time until it's done
//  - task with a due date but no time   → one gentle summary per due day at prefs.dueMorningTime
export function buildTaskNotifs(tasks, prefs, now = new Date(), { idBase = 5001, max = 500 } = {}) {
  if (!prefs.enabled) return [];
  const notifs = [];
  const dueByDay = new Map();
  const push = n => { if (notifs.length < max) notifs.push({ id: idBase + notifs.length, title: "MyBattery", ...n }); };
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DUE_NUDGE_HORIZON_DAYS);

  tasks.forEach(t => {
    if (t.done) return;
    if (t.reminderTime) {
      const time = parseTime(t.reminderTime);
      if (!time) return;
      const body = `⏰ ${t.name}`;
      if (t.dueDate) {
        const [y, mo, d] = t.dueDate.split("-").map(Number);
        const at = new Date(y, mo - 1, d, time.hour, time.minute, 0, 0);
        if (at > now) push({ body, schedule: { at, allowWhileIdle: true } });
      } else {
        push({ body, schedule: { on: time, repeats: true, allowWhileIdle: true } });
      }
    } else if (t.dueDate) {
      (dueByDay.get(t.dueDate) ?? dueByDay.set(t.dueDate, []).get(t.dueDate)).push(t);
    }
  });

  const nudge = parseTime(prefs.dueMorningTime);
  if (nudge) {
    [...dueByDay.keys()].sort().forEach(day => {
      const [y, mo, d] = day.split("-").map(Number);
      const at = new Date(y, mo - 1, d, nudge.hour, nudge.minute, 0, 0);
      if (!(at > now) || at > horizon) return;
      const due = dueByDay.get(day);
      const body = due.length === 1 ? `Due today: ${due[0].name}` : `${due.length} things are due today, including ${due[0].name}`;
      push({ body, schedule: { at, allowWhileIdle: true } });
    });
  }
  return notifs;
}
