import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// PLACEHOLDER — paste your firebaseConfig object from Firebase console here
const firebaseConfig = {
  apiKey:            "REPLACE_API_KEY",
  authDomain:        "REPLACE_AUTH_DOMAIN",
  projectId:         "REPLACE_PROJECT_ID",
  storageBucket:     "REPLACE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
  appId:             "REPLACE_APP_ID",
};

// PLACEHOLDER — paste your VAPID key from Firebase console → Project settings → Cloud Messaging
export const VAPID_KEY = "REPLACE_VAPID_KEY";

export const app       = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Request permission and get the FCM registration token.
// The token is what Cloud Functions use to target this device.
export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(messaging, {
      vapidKey:           VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js"),
    });
    return token;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
}

// Foreground message handler — called when app is open and a push arrives
export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}
