import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  sendPasswordResetEmail, deleteUser,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, deleteDoc,
  query, orderBy, limit, getDocs, serverTimestamp, onSnapshot, Timestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyCDGjf4VK9yeIoLxcg6-nSSoc0wCC4h4Nc",
  authDomain:        "mindfulstillflow.firebaseapp.com",
  projectId:         "mindfulstillflow",
  storageBucket:     "mindfulstillflow.firebasestorage.app",
  messagingSenderId: "401752681008",
  appId:             "1:401752681008:web:b76648bffed19d7cf4dbf5",
  measurementId:     "G-XSKDDSHR4L",
};

export const VAPID_KEY = "BBtu6NK8QcqAJtdFJeKpPsrrWaousw2Zj7nL2vcB6wj-H5ZZfjt-1T4_IeugdjAt5N3wtwiwTSfqC1d5fmuDPzg";

export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

export const messaging = (typeof window !== "undefined" && "serviceWorker" in navigator)
  ? (() => { try { return getMessaging(app); } catch { return null; } })()
  : null;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const createAccount = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const signIn        = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signInGoogle  = Capacitor.isNativePlatform()
  ? null
  : () => signInWithPopup(auth, new GoogleAuthProvider());
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
    "auth/too-many-requests":     "Too many attempts. Please try again later.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
export { friendlyAuthError };

// ─── Client-side encryption (Web Crypto / AES-GCM) ───────────────────────────
// Keys are derived from the user's uid via PBKDF2 and cached for the session.
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
  } catch { return encoded; } // fallback: return raw value for unencrypted legacy data
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
  const subcollections = ["days", "journal", "calendar"];
  const snaps = await Promise.all(
    subcollections.map(sub => getDocs(collection(db, "users", uid, sub)))
  );
  const deletes = snaps.flatMap(snap => snap.docs.map(d => deleteDoc(d.ref)));
  await Promise.all(deletes);
  await deleteDoc(doc(db, "users", uid));
}

// ─── Auth: Delete account (Firestore docs + Auth profile) ────────────────────
// Deletes all Firestore subcollections then removes the Firebase Auth user.
// Throws auth/requires-recent-login if the session is too old — callers should
// prompt the user to re-authenticate before retrying.
export async function deleteAccount(uid) {
  const subcollections = ["days", "journal", "calendar"];
  const snaps = await Promise.all(
    subcollections.map(sub => getDocs(collection(db, "users", uid, sub)))
  );
  const deletes = snaps.flatMap(snap => snap.docs.map(d => deleteDoc(d.ref)));
  await Promise.all(deletes);
  await deleteDoc(doc(db, "users", uid));
  await deleteUser(auth.currentUser);
}

// ─── Firestore: Feedback ─────────────────────────────────────────────────────
export async function saveFeedback(entry) {
  await addDoc(collection(db, "feedback"), {
    ...entry, createdAt: serverTimestamp(),
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

// ─── FCM ──────────────────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js"),
    });
    return token;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
}

export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}

export async function getIdToken() {
  try {
    const user = auth.currentUser;
    return user ? user.getIdToken() : null;
  } catch { return null; }
}
