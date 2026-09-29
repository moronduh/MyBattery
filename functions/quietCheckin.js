// Pure decision logic for the "quiet check-in" notification — kept free of
// Firebase imports so it can be unit tested directly.

const QUIET_DAYS     = 3;          // days without logging before we reach out
const QUIET_SEND_AT  = [12, 0];    // local time to send — midday, never early or late
const DAY_MS         = 24 * 60 * 60 * 1000;

const QUIET_LINK = "/?tab=wellness";

const QUIET_NOTIFICATION = {
  title: "🌿 Just checking in",
  body:  "We noticed you haven't been logging. We hope you're feeling okay — no need to do anything, we're here whenever you want us.",
};

// Firestore Timestamp | Date | number | null → epoch ms (or null)
function toMillis(t) {
  if (t == null) return null;
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  if (typeof t.toMillis === "function") return t.toMillis();
  return null;
}

// Decides whether a user should get the quiet check-in right now.
//   prefs           — notifPrefs.prefs
//   local           — [hh, mm] in the user's timezone (from localHourMinute)
//   lastActivityMs  — most recent time the user logged anything (null = never)
//   lastNudgeMs     — when we last sent this notification (null = never)
//   nowMs           — current time
function shouldSendQuietCheckin({ prefs, local, lastActivityMs, lastNudgeMs, nowMs }) {
  if (prefs?.quietCheckinEnabled === false) return false;
  if (!local || local[0] !== QUIET_SEND_AT[0] || local[1] !== QUIET_SEND_AT[1]) return false;
  // Never logged anything — "we noticed you haven't been logging" wouldn't make sense.
  if (lastActivityMs == null) return false;
  if (nowMs - lastActivityMs < QUIET_DAYS * DAY_MS) return false;
  // Only once per quiet stretch: if we've already reached out since they last
  // logged, stay quiet. Repeated nudges to someone who's struggling feel like pressure.
  if (lastNudgeMs != null && lastNudgeMs > lastActivityMs) return false;
  return true;
}

module.exports = {
  QUIET_DAYS,
  QUIET_SEND_AT,
  QUIET_LINK,
  QUIET_NOTIFICATION,
  toMillis,
  shouldSendQuietCheckin,
};
