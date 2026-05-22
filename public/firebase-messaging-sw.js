// Firebase Messaging Service Worker
// Handles background push notifications when the app is closed or in the background.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyCDGjf4VK9yeIoLxcg6-nSSoc0wCC4h4Nc",
  authDomain:        "mindfulstillflow.firebaseapp.com",
  projectId:         "mindfulstillflow",
  storageBucket:     "mindfulstillflow.firebasestorage.app",
  messagingSenderId: "401752681008",
  appId:             "1:401752681008:web:b76648bffed19d7cf4dbf5",
});

const messaging = firebase.messaging();

// Background message handler — shown when app is not in foreground
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? "MyBattery", {
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
