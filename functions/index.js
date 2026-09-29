const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule }                    = require("firebase-functions/v2/scheduler");
const { defineSecret }                  = require("firebase-functions/params");
const { initializeApp }                 = require("firebase-admin/app");
const { getFirestore }                  = require("firebase-admin/firestore");
const { getMessaging }                  = require("firebase-admin/messaging");
const { getAuth }                       = require("firebase-admin/auth");
const { QUIET_LINK, QUIET_NOTIFICATION, toMillis, shouldSendQuietCheckin } = require("./quietCheckin");

const geminiApiKey     = defineSecret("GEMINI_API_KEY");
// Waitlist email notifications — set these secrets before deploying:
//   firebase functions:secrets:set GMAIL_USER        (e.g. yourname@gmail.com)
//   firebase functions:secrets:set GMAIL_APP_PASSWORD (Google account → Security → App passwords)
const gmailUser        = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

initializeApp();
const db = getFirestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

// Returns [hh, mm] in the user's local timezone, or null if tz is invalid.
// Cloud Functions run in UTC — all time comparisons must go through this.
function localHourMinute(tz) {
  if (!tz || typeof tz !== "string") return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    let hh = parseInt(parts.find(p => p.type === "hour").value,   10);
    const mm = parseInt(parts.find(p => p.type === "minute").value, 10);
    if (hh === 24) hh = 0; // Node.js Intl quirk: midnight can return 24 instead of 0
    return (isNaN(hh) || isNaN(mm)) ? null : [hh, mm];
  } catch { return null; }
}

// Per-user daily AI call limiter stored in aiUsage/{uid}:{date}.
// Returns true if the call is allowed, false if the limit is exceeded.
// Fails open — if Firestore is unavailable, the call proceeds.
async function checkRateLimit(uid, limit) {
  const today = new Date().toISOString().slice(0, 10);
  const ref   = db.collection("aiUsage").doc(`${uid}:${today}`);
  try {
    return await db.runTransaction(async tx => {
      const snap  = await tx.get(ref);
      const count = snap.exists ? snap.data().count : 0;
      if (count >= limit) return false;
      tx.set(ref, { count: count + 1, uid, date: today }, { merge: true });
      return true;
    });
  } catch { return false; }
}

// ─── aiCoach ──────────────────────────────────────────────────────────────────
// Callable: { message, context: { battery, tasks, energyMap, date } }
// Returns: { reply }
exports.aiCoach = onCall({ secrets: [geminiApiKey], cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");

  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const { message, context = {}, history = [] } = request.data || {};
  if (!message) throw new HttpsError("invalid-argument", "No message provided.");
  if (typeof message !== "string" || message.length > 2000)
    throw new HttpsError("invalid-argument", "Message must be a string under 2000 characters.");
  if (!Array.isArray(history) || history.length > 20)
    throw new HttpsError("invalid-argument", "History must be an array of at most 20 turns.");

  const allowed = await checkRateLimit(request.auth.uid, 30);
  if (!allowed) throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");

  const genAI = new GoogleGenerativeAI(geminiApiKey.value());
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const rawTasks = Array.isArray(context.tasks) ? context.tasks : [];
  const safeTasks = rawTasks
    .filter(t => t && typeof t.name === "string" && t.name.trim().length > 0 && t.name.length <= 200)
    .slice(0, 50);
  const taskList = safeTasks.length
    ? safeTasks.map(t => `${t.done === true ? "✓" : "○"} ${t.name.trim().slice(0, 200)}${typeof t.priority === "string" ? ` [${t.priority.slice(0, 20)}]` : ""}`).join("\n")
    : "No tasks listed.";

  const systemPrompt = `You are an energy-aware productivity coach inside MyBattery, a mindful productivity app.

Current context:
- Battery level: ${context.battery ?? "unknown"}%
- Date: ${context.date ?? new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
- Tasks:
${taskList}

Guiding principles:
• Keep replies warm, concise, and actionable (2–4 sentences unless breaking down tasks).
• Always consider the user's energy level — never suggest pushing through exhaustion.
• When battery is below 40%, suggest lighter tasks, breaks, or rest.
• When asked to break down a task, give 3–5 small, energy-sized subtasks.
• Be encouraging but honest. Avoid toxic positivity.
• When listing tasks (numbered lists), use clean action-noun titles — never echo the user's request phrasing. "help me study for my test" → "Study for exam". "can you plan fixing the sink?" → "Fix kitchen sink".`;

  // Build contents array with history
  const contents = [];
  for (const turn of history) {
    if (typeof turn.text !== "string") continue;
    contents.push({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.text }] });
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  const chat = model.startChat({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    history: contents.slice(0, -1),
  });

  const result = await chat.sendMessage(message);
  return { reply: result.response.text() };
});

// ─── generateSchedule ────────────────────────────────────────────────────────
// Callable: { input, context: { battery, role, date, energyMap, existingTasks } }
// Returns: { tasks[], summary, energyProjection } | { error }
exports.generateSchedule = onCall({ secrets: [geminiApiKey], cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");

  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const { input, context = {} } = request.data || {};
  if (!input) throw new HttpsError("invalid-argument", "No input provided.");
  if (typeof input !== "string" || input.length > 2000)
    throw new HttpsError("invalid-argument", "Input must be a string under 2000 characters.");

  const allowed = await checkRateLimit(request.auth.uid, 10);
  if (!allowed) throw new HttpsError("resource-exhausted", "Daily schedule limit reached. Try again tomorrow.");

  const genAI = new GoogleGenerativeAI(geminiApiKey.value());
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const battery = context.battery ?? 100;
  const tier    = battery < 20 ? "Critical" : battery < 40 ? "Low" : battery < 75 ? "Medium" : "High";
  const role    = context.role    || "General";
  const date    = context.date    || new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });

  const existingStr = Array.isArray(context.existingTasks) && context.existingTasks.length
    ? context.existingTasks
        .filter(t => t && typeof t.name === "string" && t.name.trim().length > 0)
        .slice(0, 20)
        .map(t => `- ${t.name.replace(/[\r\n]/g, " ").slice(0, 200)} (${String(t.bucket ?? "?").replace(/[\r\n]/g, "")}, ${Number.isFinite(t.duration) ? t.duration : 30}min)`)
        .join("\n") || "None"
    : "None";

  const systemPrompt = `You are the schedule generation engine for MyBattery, an energy-management productivity app.
Your ONLY output is valid raw JSON. No greeting. No prose. No markdown code fences. No explanation.
If you cannot produce a valid schedule, output exactly: {"error":"Could not parse schedule. Please describe your tasks and times more clearly."}

## RUNTIME CONTEXT
Battery: ${battery}% (${tier} energy)
Role: ${role}
Date: ${date}
Existing tasks already on the list:
${existingStr}

## OUTPUT SCHEMA (return this exact shape)
{
  "tasks": [
    {
      "name": string,          // concise action-noun label ≤40 chars — NEVER echo the user's request phrasing (e.g. never "help me study" → use "Study for exam")
      "bucket": "must"|"should"|"could",
      "startTime": "HH:MM"|null,
      "endTime": "HH:MM"|null,
      "duration": number,      // minutes, always positive integer
      "energyImpact": number,  // negative=drains, positive=recharges
      "subtasks": string[]     // 0–4 items, each ≤50 chars
    }
  ],
  "summary": string,           // 1–2 warm sentences referencing battery level
  "energyProjection": number   // estimated battery % after completing all tasks
}

## BUCKETING RULES
- "must"   → fixed appointments, hard deadlines, non-negotiables (class, work shift, exams, meetings)
- "should" → important but flexible (studying, exercise, key errands)
- "could"  → deferrable, nice-to-have (reading, hobbies, social media, browsing)
- Battery < 30%: demote all unanchored "should" tasks to "could". Be explicit in the summary.
- Battery < 50%: limit total "must"+"should" draining tasks to ≤4 items.

## DURATION RULES
- Parse explicit: "1 hour"→60, "45 min"→45, "2 hrs"→120
- Infer from type if omitted: lecture/class→75, gym/workout→60, shower→15,
  meal/lunch→30, commute→20, meeting→45, deep study session→90, light reading→30
- Minimum 5 minutes. Round to nearest 5.

## TIME RULES
- 24h format only. "10am"→"10:00", "3:30pm"→"15:30"
- endTime = startTime + duration (in minutes), carried forward across hours
- Respect implied sequence: "after class" means class.endTime + 10min buffer
- Anchor tasks without explicit times as null/null (unscheduled)

## ENERGY IMPACT RULES
Draining (negative):
  -5   trivial admin, 5–10 min task
  -10  light cognitive (email, short reading)
  -15  moderate physical (30min walk/gym)
  -20  moderate cognitive (1hr studying, meeting)
  -30  heavy cognitive (2hr deep work, coding session)
  -40  high stress or physically demanding (exam, long workout, confrontation)
  -50  extreme drain (all-day event, high-stakes presentation)
Recharging (positive):
  +5   micro-break, short walk, snack
  +8   proper meal break
  +12  light nap (20min), meditation
  +18  full rest period (1hr+)
Battery < 40%: cap any single draining task at -15. Flag heavy tasks as "could".

## SUBTASK RULES
- Only generate subtasks for duration > 45min OR tasks with obvious multi-step structure
- 2–4 items, each ≤50 characters, actionable verbs ("Review notes", "Draft outline")
- Do NOT generate subtasks for meals, commutes, simple errands

## SUMMARY RULES
- Address the user warmly (1–2 sentences maximum)
- Reference their battery tier and whether the day looks manageable
- If battery is low, acknowledge it and mention what was de-prioritized
- Example: "Solid plan for a 66% battery day. I've anchored your fixed commitments in the morning and left the afternoon flexible."`;

  const result = await model.generateContent({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: input }] }],
  });

  const raw = result.response.text().trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return { error: "The AI returned an unexpected format. Please try rephrasing your day." };
  }
});

// ─── savePrefs ────────────────────────────────────────────────────────────────
// Called by the app when the user saves their notification preferences.
// Stores the FCM token + prefs in notifPrefs/{uid} — one doc per user.
exports.savePrefs = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) { res.status(401).json({ error: "Unauthorized" }); return; }
  let uid;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  const { token, prefs } = req.body;
  if (!token || typeof token !== "string" || token.length > 500) {
    res.status(400).json({ error: "Invalid token" }); return;
  }
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
    res.status(400).json({ error: "Invalid prefs" }); return;
  }

  await db.collection("notifPrefs").doc(uid).set({ token, prefs, updatedAt: new Date() });
  res.json({ ok: true });
});

// ─── sendCheckin ──────────────────────────────────────────────────────────────
// Runs every minute, checks if it's time to send the morning check-in notification.
exports.sendCheckin = onSchedule("every 1 minutes", async () => {
  const snap = await db.collection("notifPrefs").get();
  if (snap.empty) return;

  const sends = [];
  for (const doc of snap.docs) {
    const { token, prefs } = doc.data();
    if (!prefs?.checkinEnabled || !token) continue;
    if (prefs.platform === "ios") continue; // the iPhone app schedules this reminder on-device
    if (typeof prefs.checkinTime !== "string" || !/^\d{1,2}:\d{2}$/.test(prefs.checkinTime)) continue;
    const [hh, mm] = prefs.checkinTime.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) continue;
    const local = localHourMinute(prefs.timezone);
    if (!local || local[0] !== hh || local[1] !== mm) continue;
    sends.push(getMessaging().send({
      token,
      notification: {
        title: "🌿 Good morning — how are you arriving?",
        body:  "Take 30 seconds to set your energy level for the day.",
      },
      webpush: { fcmOptions: { link: "/" } },
    }));
  }
  await Promise.allSettled(sends);
});

// ─── sendStillness ────────────────────────────────────────────────────────────
// Runs every minute, fires a stillness reminder based on the user's interval.
exports.sendStillness = onSchedule("every 1 minutes", async () => {
  const snap = await db.collection("notifPrefs").get();
  if (snap.empty) return;

  const msgs = [
    "Step away. Let your mind wander.",
    "Look at something far away. Breathe.",
    "One minute of quiet. Nothing to do.",
    "Rest your eyes. You've earned this pause.",
  ];

  const sends = [];
  for (const doc of snap.docs) {
    const { token, prefs } = doc.data();
    if (!prefs?.stillnessEnabled || !token) continue;
    const local = localHourMinute(prefs.timezone);
    if (!local) continue;
    const [localHH, localMM] = local;
    const withinWindow = localHH >= 8 && localHH < 18;
    if (!withinWindow) continue;
    const intervalMins = parseInt(prefs.stillnessEvery, 10) || 25;
    const totalMins = localHH * 60 + localMM;
    if (totalMins % intervalMins !== 0) continue;
    const body = msgs[Math.floor(Math.random() * msgs.length)];
    sends.push(getMessaging().send({
      token,
      notification: { title: "🌿 Stillness break", body },
      webpush: { fcmOptions: { link: "/" } },
    }));
  }
  await Promise.allSettled(sends);
});

// ─── sendWinddown ─────────────────────────────────────────────────────────────
// Runs every minute, checks if it's time to send the wind-down reminder.
exports.sendWinddown = onSchedule("every 1 minutes", async () => {
  const snap = await db.collection("notifPrefs").get();
  if (snap.empty) return;

  const sends = [];
  for (const doc of snap.docs) {
    const { token, prefs } = doc.data();
    if (!prefs?.winddownEnabled || !token) continue;
    if (prefs.platform === "ios") continue; // the iPhone app schedules this reminder on-device
    if (typeof prefs.winddownTime !== "string" || !/^\d{1,2}:\d{2}$/.test(prefs.winddownTime)) continue;
    const [hh, mm] = prefs.winddownTime.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) continue;
    const local = localHourMinute(prefs.timezone);
    if (!local || local[0] !== hh || local[1] !== mm) continue;
    sends.push(getMessaging().send({
      token,
      notification: {
        title: "🌙 Time to wind down.",
        body:  "Begin your end-of-day ritual. You showed up — that's the whole thing.",
      },
      webpush: { fcmOptions: { link: "/" } },
    }));
  }
  await Promise.allSettled(sends);
});

// ─── joinWaitlist ──────────────────────────────────────────────────────────────
// Callable: { email, source? }  source = "landing" | "app"
// Stores the signup in waitlist/{auto-id} and fires a notification email.
exports.joinWaitlist = onCall(
  { secrets: [gmailUser, gmailAppPassword], cors: true },
  async (request) => {
    const { email, source: rawSource = "app" } = request.data || {};

    // Validate
    if (!email || typeof email !== "string") {
      throw new HttpsError("invalid-argument", "Email is required.");
    }
    const cleaned = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      throw new HttpsError("invalid-argument", "Please enter a valid email address.");
    }
    if (cleaned.length > 254) {
      throw new HttpsError("invalid-argument", "Email address is too long.");
    }
    const source = ["landing", "app"].includes(rawSource) ? rawSource : "app";

    // Duplicate check (best-effort — not transactional)
    const existing = await db.collection("waitlist")
      .where("email", "==", cleaned).limit(1).get();
    if (!existing.empty) {
      return { ok: true, duplicate: true };
    }

    // Persist
    await db.collection("waitlist").add({
      email:     cleaned,
      source,
      createdAt: new Date(),
      uid:       request.auth?.uid ?? null,
    });

    // Notify — wrapped so a mail failure never blocks the signup
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser.value(), pass: gmailAppPassword.value() },
      });
      await transporter.sendMail({
        from:    `"MyBattery Waitlist" <${gmailUser.value()}>`,
        to:      "info@mybatteryapp.com",
        subject: `🔋 New waitlist signup — ${cleaned}`,
        text:    `${cleaned} just joined the MyBattery waitlist.\n\nSource: ${source}\nTime: ${new Date().toUTCString()}`,
        html:    `<p><strong>${escapeHtml(cleaned)}</strong> just joined the MyBattery waitlist.</p><p>Source: <code>${escapeHtml(source)}</code><br>Time: ${new Date().toUTCString()}</p>`,
      });
    } catch (mailErr) {
      console.error("[joinWaitlist] email failed:", mailErr.message);
    }

    return { ok: true, duplicate: false };
  }
);

// ─── sendQuietCheckin ─────────────────────────────────────────────────────────
// Runs every minute. If someone hasn't logged anything for a few days, sends one
// gentle "hope you're okay" notification that opens the Wellness tab. Sent at
// most once per quiet stretch — it resets the next time they log something.
exports.sendQuietCheckin = onSchedule("every 1 minutes", async () => {
  const snap = await db.collection("notifPrefs").get();
  if (snap.empty) return;

  const nowMs = Date.now();
  const sends = [];
  for (const doc of snap.docs) {
    const { token, prefs } = doc.data();
    if (!token) continue;
    const local = localHourMinute(prefs?.timezone || "UTC");
    // Cheap checks first; only users at their send minute cost any reads.
    if (!shouldSendQuietCheckin({ prefs, local, lastActivityMs: 0, lastNudgeMs: null, nowMs })) continue;
    sends.push(maybeSendQuietCheckin(doc.id, token, prefs, local, nowMs));
  }
  await Promise.allSettled(sends);
});

async function latestMillis(query, field) {
  const s = await query.orderBy(field, "desc").limit(1).get();
  return s.empty ? null : toMillis(s.docs[0].get(field));
}

async function maybeSendQuietCheckin(uid, token, prefs, local, nowMs) {
  const user     = db.collection("users").doc(uid);
  const nudgeRef = db.collection("quietCheckins").doc(uid);
  const [days, journal, tasksCreated, tasksUpdated, nudgeSnap] = await Promise.all([
    latestMillis(user.collection("days"),    "updatedAt"),
    latestMillis(user.collection("journal"), "createdAt"),
    latestMillis(user.collection("tasks"),   "createdAt"),
    latestMillis(user.collection("tasks"),   "updatedAt"),
    nudgeRef.get(),
  ]);
  const times = [days, journal, tasksCreated, tasksUpdated].filter(t => t != null);
  const lastActivityMs = times.length ? Math.max(...times) : null;
  const lastNudgeMs    = nudgeSnap.exists ? toMillis(nudgeSnap.get("sentAt")) : null;
  if (!shouldSendQuietCheckin({ prefs, local, lastActivityMs, lastNudgeMs, nowMs })) return;

  await getMessaging().send({
    token,
    notification: QUIET_NOTIFICATION,
    data:    { link: QUIET_LINK },
    webpush: { fcmOptions: { link: QUIET_LINK } },
  });
  await nudgeRef.set({ sentAt: new Date(nowMs) });
}
