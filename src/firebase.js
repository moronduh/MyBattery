import { initializeApp, getApps, getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
// firebase/messaging requires service workers — dynamically imported on web only (see below)
import {
  getAuth, initializeAuth, inMemoryPersistence, indexedDBLocalPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, sendPasswordResetEmail, deleteUser,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, deleteDoc,
  query, where, orderBy, limit, getDocs, serverTimestamp, onSnapshot,
  Timestamp, writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCDGjf4VK9yeIoLxcg6-nSSoc0wCC4h4Nc",
  // On native, omit authDomain — Firebase Auth uses it to load Google's gapi scripts
  // for popup/redirect OAuth, which crashes WKWebView on iOS 18 due to CORS on capacitor:// origin.
  authDomain:        Capacitor.isNativePlatform() ? undefined : "mindfulstillflow.firebaseapp.com",
  projectId:         "mindfulstillflow",
  storageBucket:     "mindfulstillflow.firebasestorage.app",
  messagingSenderId: "401752681008",
  appId:             "1:401752681008:web:b76648bffed19d7cf4dbf5",
  measurementId:     "G-XSKDDSHR4L",
};

export const VAPID_KEY = "BBtu6NK8QcqAJtdFJeKpPsrrWaousw2Zj7nL2vcB6wj-H5ZZfjt-1T4_IeugdjAt5N3wtwiwTSfqC1d5fmuDPzg";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
// On native, use initializeAuth with inMemoryPersistence to prevent Firebase from
// loading Google's popup/redirect infrastructure (gapi), which crashes in WKWebView
// because capacitor:// origin is blocked by Google's CORS policy.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, inMemoryPersistence] })
  : getAuth(app);
export const db        = getFirestore(app);
export const functions = getFunctions(app);

export async function callAICoach(data) {
  const fn = httpsCallable(functions, "aiCoach");
  const result = await fn(data);
  return result.data;
}

export async function callScheduleGenerator(data) {
  const fn = httpsCallable(functions, "generateSchedule", { timeout: 60000 });
  const result = await fn(data);
  return result.data;
}

export async function callJoinWaitlist(data) {
  const fn = httpsCallable(functions, "joinWaitlist");
  const result = await fn(data);
  return result.data;
}

// Firebase Messaging is web-only — service workers don't exist in WKWebView (Capacitor iOS).
// The static import was removed to prevent the module from loading on native at all.
// getMessagingInstance() lazily initializes on web only.
let _messaging = undefined;
async function getMessagingInstance() {
  if (Capacitor.isNativePlatform() || typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (_messaging === undefined) {
    try {
      const { getMessaging } = await import("firebase/messaging");
      _messaging = getMessaging(app);
    } catch {
      _messaging = null;
    }
  }
  return _messaging;
}
export const messaging = null; // kept for any legacy references — use getMessagingInstance() internally

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const createAccount = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const signIn        = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
// Popup first. Embedded browsers (in-app panes, some webviews) open the popup but never hear
// back from it, which left the sign-in screen stuck on "…" forever. If the popup is blocked,
// unsupported, or silent for too long, fall back to the full-page redirect flow
// (handleGoogleRedirect picks up the result on return).
const POPUP_FALLBACK_MS = 30000;
export const signInGoogle  = Capacitor.isNativePlatform()
  ? null
  : async () => {
      const provider = new GoogleAuthProvider();
      let timer;
      const silent = new Promise((_, reject) => {
        timer = setTimeout(() => reject({ code: "auth/popup-timeout" }), POPUP_FALLBACK_MS);
      });
      try {
        return await Promise.race([signInWithPopup(auth, provider), silent]);
      } catch (err) {
        if (["auth/popup-blocked", "auth/popup-timeout", "auth/operation-not-supported-in-this-environment"].includes(err?.code)) {
          return signInWithRedirect(auth, provider);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    };
export const handleGoogleRedirect = () => getRedirectResult(auth);
export const signOutUser   = ()       => signOut(auth);
export const resetPassword = (email)  => sendPasswordResetEmail(auth, email);
export const onAuthChange  = (cb)     => onAuthStateChanged(auth, cb);

function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use":  "An account with that email already exists.",
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/weak-password":         "Password must be at least 6 characters.",
    "auth/user-not-found":        "No account found with that email.",
    "auth/wrong-password":        "Incorrect password.",
    "auth/invalid-credential":    "Incorrect email or password.",
    "auth/too-many-requests":       "Too many attempts. Please try again later.",
    "auth/popup-blocked":           "Sign-in popup was blocked. Please allow popups or try again.",
    "auth/popup-closed-by-user":    null, // silently ignored
    "auth/unauthorized-domain":     "This domain isn't authorized for Google sign-in. Check Firebase Console → Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed":   "Google sign-in isn't enabled. Enable it in Firebase Console → Authentication → Sign-in method.",
    "auth/cancelled-popup-request": null, // silently ignored
  };
  return map[code] || `Something went wrong (${code || "unknown"}). Please try again.`;
}
export { friendlyAuthError };

// ─── Client-side encryption (Web Crypto / AES-GCM) ───────────────────────────
//
// Threat model: protects task names and health notes at rest in Firestore from
// Anthropic/Google employees, database dumps, and misconfigured rules — NOT from
// the authenticated user themselves (they hold the key material).
//
// Key derivation: PBKDF2(uid, salt="reflow-enc-v1", 100k iterations, SHA-256) → AES-GCM-256.
// The uid is the Firebase Auth UID, available only after sign-in.
// Derived keys are cached in _keyCache for the lifetime of the browser session.
//
// Wire format: base64( iv[12 bytes] || ciphertext ).
// Both encryptField and decryptField are safe to call on already-plaintext values:
//   encryptField: encrypts and returns base64.
//   decryptField: on failure (e.g. legacy plaintext), returns the input unchanged.
//
// Callers: loadUserData() decrypts task names on load; saveTasks() encrypts them on save.
// Do NOT call encryptField on already-encrypted values — there is no double-encrypt guard.
const _keyCache = {};

async function deriveKey(uid) {
  if (_keyCache[uid]) return _keyCache[uid];
  const enc = new TextEncoder();
  const raw = await crypto.subtle.importKey(
    "raw", enc.encode(uid), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("reflow-enc-v1"), iterations: 100000, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  _keyCache[uid] = key;
  return key;
}

export async function encryptField(text, uid) {
  if (!text || !uid) return text;
  try {
    const key = await deriveKey(uid);
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
    const combined = new Uint8Array(iv.byteLength + buf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(buf), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  } catch { return text; }
}

export async function decryptField(encoded, uid) {
  if (!encoded || !uid) return encoded;
  try {
    const combined  = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const iv        = combined.slice(0, 12);
    const cipherBuf = combined.slice(12);
    const key = await deriveKey(uid);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);
    return new TextDecoder().decode(plain);
  } catch { return encoded; } // legacy plaintext or wrong key → return as-is
}

// ─── Firestore: User profile ──────────────────────────────────────────────────
export async function saveUserProfile(uid, profile) {
  await setDoc(doc(db, "users", uid), { profile, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  // Decrypt task names for any encrypted tasks
  if (Array.isArray(data.tasks)) {
    data.tasks = await Promise.all(
      data.tasks.map(async t => ({
        ...t,
        name: t._enc ? await decryptField(t.name, uid) : t.name,
      }))
    );
  }
  // Ensure recurringEvents is always an array
  if (!Array.isArray(data.recurringEvents)) data.recurringEvents = [];
  return data;
}

export async function saveRecurringEvents(uid, events) {
  await setDoc(
    doc(db, "users", uid),
    { recurringEvents: events, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── Firestore: Daily record ──────────────────────────────────────────────────
export async function saveDailyRecord(uid, dateKey, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  // Encrypt free-text mood/check-in fields
  if (payload.moodNote)    payload.moodNote    = await encryptField(payload.moodNote,    uid);
  if (payload.bodyCheckin) payload.bodyCheckin = await encryptField(payload.bodyCheckin, uid);
  if (payload.intention)   payload.intention   = await encryptField(payload.intention,   uid);
  await setDoc(doc(db, "users", uid, "days", dateKey), payload, { merge: true });
}

// ─── Firestore: Tasks ─────────────────────────────────────────────────────────
export async function saveTasks(uid, tasks) {
  const encrypted = await Promise.all(
    tasks.map(async t => ({
      ...t,
      name: t.name ? await encryptField(t.name, uid) : t.name,
      _enc: true,
    }))
  );
  await setDoc(
    doc(db, "users", uid),
    { tasks: encrypted, tasksUpdatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── Firestore: Calendar (per-day document with real-time subscription) ───────
export async function saveCalendarDay(uid, dateKey, schedule, events) {
  await setDoc(
    doc(db, "users", uid, "calendar", dateKey),
    { schedule, events, updatedAt: serverTimestamp() },
    { merge: false }   // full replace so deleted blocks don't linger
  );
}

// Returns an unsubscribe function. Calls callback({ schedule, events }) on
// every Firestore update for the given day.
export function subscribeCalendarDay(uid, dateKey, callback) {
  const ref = doc(db, "users", uid, "calendar", dateKey);
  return onSnapshot(ref, snap => {
    if (snap.exists()) {
      callback({ schedule: snap.data().schedule || {}, events: snap.data().events || [] });
    } else {
      callback({ schedule: {}, events: [] });
    }
  });
}

// ─── Firestore: Journal entries ───────────────────────────────────────────────
export async function saveJournalEntry(uid, entry) {
  return addDoc(collection(db, "users", uid, "journal"), {
    ...entry, createdAt: serverTimestamp(),
  });
}

export async function deleteJournalEntry(uid, entryId) {
  await deleteDoc(doc(db, "users", uid, "journal", entryId));
}

// ─── Firestore: Clear all user data ──────────────────────────────────────────
export async function clearUserData(uid) {
  const subcollections = ["days", "journal", "calendar", "tasks"];
  const snaps = await Promise.all(
    subcollections.map(sub => getDocs(collection(db, "users", uid, sub)))
  );
  const deletes = snaps.flatMap(snap => snap.docs.map(d => deleteDoc(d.ref)));
  await Promise.all(deletes);
  await deleteDoc(doc(db, "users", uid));
}

// ─── Auth: Delete account (Firestore docs + Auth profile) ────────────────────
// Re-authenticates first, then deletes all Firestore subcollections, then removes
// the Firebase Auth user. Re-auth must happen before any data is touched: if it
// fails (wrong password, cancelled Google popup, stale session), we bail out with
// the account's data still intact instead of wiping it and only then discovering
// deleteUser() needs a fresher login.
export async function deleteAccount(uid, password) {
  const user = auth.currentUser;
  if (password) {
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }
  const subcollections = ["days", "journal", "calendar", "tasks"];
  const snaps = await Promise.all(
    subcollections.map(sub => getDocs(collection(db, "users", uid, sub)))
  );
  const deletes = snaps.flatMap(snap => snap.docs.map(d => deleteDoc(d.ref)));
  await Promise.all(deletes);
  await deleteDoc(doc(db, "users", uid));
  await deleteDoc(doc(db, "notifPrefs", uid)).catch(() => {});
  await deleteUser(auth.currentUser);
}

// ─── Firestore: Feedback ─────────────────────────────────────────────────────
export async function saveFeedback(entry) {
  await addDoc(collection(db, "feedback"), {
    uid:        entry.uid        ?? null,
    text:       String(entry.message ?? entry.text ?? "").slice(0, 2000),
    ts:         entry.ts         ?? new Date().toISOString(),
    type:       entry.type       ?? "general",
    appVersion: entry.appVersion ?? "1.0",
  });
}

// ─── Firestore: History ───────────────────────────────────────────────────────
export async function loadRecentDays(uid, count = 8) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "days"), orderBy("updatedAt", "desc"), limit(count))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadHistory(uid) {
  const [daysSnap, journalSnap] = await Promise.all([
    getDocs(query(collection(db, "users", uid, "days"),    orderBy("updatedAt", "desc"), limit(60))),
    getDocs(query(collection(db, "users", uid, "journal"), orderBy("createdAt", "desc"), limit(100))),
  ]);
  return {
    days:    daysSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    journal: journalSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

// ─── Tasks subcollection ─────────────────────────────────────────────────────
// Schema: users/{uid}/tasks/{taskId}  — each task is its own Firestore document
// status: 'active' | 'completed'
// Incomplete tasks automatically carry over because the query filters by status.

export function subscribeActiveTasks(uid, onChange, onError) {
  const q = query(
    collection(db, "users", uid, "tasks"),
    where("status", "==", "active")
  );
  // Decrypting names is async, so two quick snapshots (local write, then server echo) can finish
  // out of order and an older list would overwrite the newer one. Drop any result that's stale.
  let latest = 0;
  return onSnapshot(q, async snap => {
    const seq = ++latest;
    const tasks = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        // Recurring tasks stay status:"active" even once completed for today (see
        // updateTaskDoc) so they carry over to the next day, so their real `done`
        // value has to come through here. Non-recurring active tasks are always
        // done:false since completing one flips status to "completed", dropping
        // it out of this query entirely.
        done: !!data.done,
        name: data._enc ? await decryptField(data.name, uid) : data.name,
      };
    }));
    if (seq !== latest) return;
    onChange(tasks);
  }, err => {
    // Keep the last-known list: wiping it to [] made tasks vanish on any transient listener error.
    console.error("Task subscription error:", err);
    onError?.(err);
  });
}

export async function addTaskDoc(uid, task) {
  const { id: _id, done: _done, ...fields } = task;
  const payload = {
    ...fields,
    name: fields.name ? await encryptField(fields.name, uid) : fields.name,
    _enc: true,
    status: "active",
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, "users", uid, "tasks"), payload);
  return ref.id;
}

export async function updateTaskDoc(uid, taskId, updates) {
  const payload = { ...updates, updatedAt: serverTimestamp() };
  if (typeof updates.name === "string") {
    payload.name = await encryptField(updates.name, uid);
    payload._enc = true;
  }
  // Callers that need to keep a task in the "active" query despite done:true
  // (recurring tasks completed for today) pass status explicitly — respect that
  // instead of deriving it from `done`.
  if (updates.done !== undefined && updates.status === undefined) {
    payload.status = updates.done ? "completed" : "active";
  }
  await setDoc(doc(db, "users", uid, "tasks", taskId), payload, { merge: true });
}

export async function deleteTaskDoc(uid, taskId) {
  await deleteDoc(doc(db, "users", uid, "tasks", taskId));
}

// ─── FCM ──────────────────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  const m = await getMessagingInstance();
  if (!m) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const { getToken } = await import("firebase/messaging");
    const token = await getToken(m, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js"),
    });
    return token;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
}

// ─── Native push (iPhone) ─────────────────────────────────────────────────────
// Uses @capacitor-firebase/messaging, so iPhones get an FCM token just like the web
// and the server's existing getMessaging().send() reaches them unchanged.
export async function requestNativePushToken() {
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== "granted") return null;
    const { token } = await FirebaseMessaging.getToken();
    return token || null;
  } catch (err) {
    console.warn("Native push token:", err);
    return null;
  }
}

// Calls back with the tapped notification's data (e.g. { link: "/?tab=wellness" }).
export async function onNativePushTap(callback) {
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    const handle = await FirebaseMessaging.addListener("notificationActionPerformed", e => callback(e.notification?.data || {}));
    return () => handle.remove();
  } catch {
    return () => {};
  }
}

export async function onForegroundMessage(callback) {
  const m = await getMessagingInstance();
  if (!m) return () => {};
  const { onMessage } = await import("firebase/messaging");
  return onMessage(m, callback);
}

export async function getIdToken() {
  try {
    const user = auth.currentUser;
    return user ? user.getIdToken() : null;
  } catch { return null; }
}

// ─── Client error reporting ───────────────────────────────────────────────────
// Writes caught errors to Firestore so failures surface without a paid monitoring service.
// Never throws — must be safe to call from catch blocks and ErrorBoundary.
export async function logClientError(error, context = {}) {
  try {
    if (!auth.currentUser) return;
    await addDoc(collection(db, "errors"), {
      msg:   String(error?.message ?? error).slice(0, 500),
      stack: String(error?.stack   ?? "").slice(0, 2000),
      uid:   auth.currentUser.uid,
      context: JSON.stringify(context).slice(0, 1000),
      ua:  navigator.userAgent.slice(0, 200),
      ts:  serverTimestamp(),
    });
  } catch { /* never throw from error reporter */ }
}
