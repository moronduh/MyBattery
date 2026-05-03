// Firebase Messaging Service Worker
// Handles background push notifications when the app is closed or in the background.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// PLACEHOLDER — replace with your real firebaseConfig values
firebase.initializeApp({
  apiKey:            "REPLACE_API_KEY",
  authDomain:        "REPLACE_AUTH_DOMAIN",
  projectId:         "REPLACE_PROJECT_ID",
  storageBucket:     "REPLACE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
  appId:             "REPLACE_APP_ID",
});

const messaging = firebase.messaging();

// Background message handler — shown when app is not in foreground
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Reflow", {
    body:  body  ?? "",
    icon:  icon  ?? "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data:  payload.data ?? {},
  });
});

// Notification click — bring the app to focus
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin) && "focus" in c);
      return existing ? existing.focus() : clients.openWindow("/");
    })
  );
});
