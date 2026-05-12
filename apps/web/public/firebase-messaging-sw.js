/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

const urlParams = new URLSearchParams(self.location.search);

const firebaseConfig = {
  apiKey: urlParams.get("apiKey"),
  authDomain: urlParams.get("authDomain"),
  projectId: urlParams.get("projectId"),
  storageBucket: urlParams.get("storageBucket"),
  messagingSenderId: urlParams.get("messagingSenderId"),
  appId: urlParams.get("appId"),
  measurementId: urlParams.get("measurementId"),
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
