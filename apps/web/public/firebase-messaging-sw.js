/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyAj35DswTroeOFF-ghjDvdW52heLA45Uso",
  authDomain: "broady-1.firebaseapp.com",
  projectId: "broady-1",
  storageBucket: "broady-1.firebasestorage.app",
  messagingSenderId: "190709096272",
  appId: "1:190709096272:web:8d7d2b10d38f27ee0f1655",
  measurementId: "G-WS9W2XZJPV",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

function resolveTargetUrl(data) {
  const targetPath = data?.targetPath || "/account/notifications";
  if (/^https?:\/\//i.test(targetPath)) {
    return targetPath;
  }

  return new URL(targetPath.startsWith("/") ? targetPath : "/account/notifications", self.location.origin).href;
}

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Broady";
  const body = payload.notification?.body || payload.data?.body || "You have a new Broady update.";

  self.registration.showNotification(title, {
    body,
    icon: payload.notification?.image || "/BROADY_LOGO.png",
    badge: "/icons/icon-192.svg",
    data: {
      targetUrl: resolveTargetUrl(payload.data),
    },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.targetUrl || new URL("/account/notifications", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && new URL(client.url).origin === self.location.origin) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
