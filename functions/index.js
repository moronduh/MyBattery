const { onRequest }  = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore }  = require("firebase-admin/firestore");
const { getMessaging }  = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── savePrefs ────────────────────────────────────────────────────────────────
// Called by the app when the user saves their notification preferences.
// Stores the FCM token + prefs in Firestore under a fixed single-user doc.
exports.savePrefs = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const { token, prefs } = req.body;
  if (!token || !prefs) { res.status(400).send("Missing token or prefs"); return; }

  await db.collection("users").doc("default").set({ token, prefs, updatedAt: new Date() });
  res.json({ ok: true });
});

// ─── sendCheckin ──────────────────────────────────────────────────────────────
// Runs every minute, checks if it's time to send the morning check-in notification.
exports.sendCheckin = onSchedule("every 1 minutes", async () => {
  const doc = await db.collection("users").doc("default").get();
  if (!doc.exists) return;

  const { token, prefs } = doc.data();
  if (!prefs.checkinEnabled || !token) return;

  const [hh, mm] = prefs.checkinTime.split(":").map(Number);
  const now = new Date();
  if (now.getHours() !== hh || now.getMinutes() !== mm) return;

  await getMessaging().send({
    token,
    notification: {
      title: "🌿 Good morning — how are you arriving?",
      body:  "Take 30 seconds to set your energy level for the day.",
    },
    webpush: { fcmOptions: { link: "/" } },
  });
});

// ─── sendStillness ────────────────────────────────────────────────────────────
// Runs every minute, fires a stillness reminder based on the user's interval.
exports.sendStillness = onSchedule("every 1 minutes", async () => {
  const doc = await db.collection("users").doc("default").get();
  if (!doc.exists) return;

  const { token, prefs } = doc.data();
  if (!prefs.stillnessEnabled || !token) return;

  const intervalMins = parseInt(prefs.stillnessEvery, 10) || 25;
  const now = new Date();
  // Only fire during work hours (8am–6pm) and when minute aligns to interval
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const withinWorkHours = now.getHours() >= 8 && now.getHours() < 18;
  if (!withinWorkHours) return;
  if (totalMins % intervalMins !== 0) return;

  const msgs = [
    "Step away. Let your mind wander.",
    "Look at something far away. Breathe.",
    "One minute of quiet. Nothing to do.",
    "Rest your eyes. You've earned this pause.",
  ];
  const body = msgs[Math.floor(Math.random() * msgs.length)];

  await getMessaging().send({
    token,
    notification: { title: "🌿 Stillness break", body },
    webpush: { fcmOptions: { link: "/" } },
  });
});

// ─── sendWinddown ─────────────────────────────────────────────────────────────
// Runs every minute, checks if it's time to send the wind-down reminder.
exports.sendWinddown = onSchedule("every 1 minutes", async () => {
  const doc = await db.collection("users").doc("default").get();
  if (!doc.exists) return;

  const { token, prefs } = doc.data();
  if (!prefs.winddownEnabled || !token) return;

  const [hh, mm] = prefs.winddownTime.split(":").map(Number);
  const now = new Date();
  if (now.getHours() !== hh || now.getMinutes() !== mm) return;

  await getMessaging().send({
    token,
    notification: {
      title: "🌙 Time to wind down.",
      body:  "Begin your end-of-day ritual. You showed up — that's the whole thing.",
    },
    webpush: { fcmOptions: { link: "/" } },
  });
});
