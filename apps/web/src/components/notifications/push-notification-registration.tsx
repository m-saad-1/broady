"use client";

import { useEffect } from "react";
import { registerNotificationDeviceToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

type FirebaseApp = unknown;

type FirebaseAppModule = {
  getApp: () => FirebaseApp;
  getApps: () => FirebaseApp[];
  initializeApp: (config: Record<string, string>) => FirebaseApp;
};

type FirebaseMessaging = unknown;

type FirebaseMessagingModule = {
  getMessaging: (app: FirebaseApp) => FirebaseMessaging;
  getToken: (
    messaging: FirebaseMessaging,
    options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration },
  ) => Promise<string>;
  isSupported: () => Promise<boolean>;
  onMessage: (
    messaging: FirebaseMessaging,
    next: (payload: { notification?: { title?: string; body?: string; image?: string }; data?: Record<string, string> }) => void,
  ) => () => void;
};

const FIREBASE_MODULE_BASE = "https://www.gstatic.com/firebasejs/12.12.1";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAj35DswTroeOFF-ghjDvdW52heLA45Uso",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "broady-1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "broady-1",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "broady-1.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "190709096272",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:190709096272:web:8d7d2b10d38f27ee0f1655",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-WS9W2XZJPV",
};

const vapidKey =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  "BPpTKerM6IDfpLCLWrcescfMj8_GPY6RfnvR_HgWarWIzxi6fMH0bmyH36ikc_sKo681zDJJISGQeLetdZ1N_No";

async function loadFirebaseMessaging() {
  const [appModule, messagingModule] = await Promise.all([
    import(/* webpackIgnore: true */ `${FIREBASE_MODULE_BASE}/firebase-app.js`) as Promise<FirebaseAppModule>,
    import(/* webpackIgnore: true */ `${FIREBASE_MODULE_BASE}/firebase-messaging.js`) as Promise<FirebaseMessagingModule>,
  ]);

  if (!(await messagingModule.isSupported())) {
    return null;
  }

  const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
  return {
    messaging: messagingModule.getMessaging(app),
    getToken: messagingModule.getToken,
    onMessage: messagingModule.onMessage,
  };
}

function resolveMessageTargetPath(payload: { data?: Record<string, string> }) {
  const targetPath = payload.data?.targetPath;
  return targetPath?.startsWith("/") ? targetPath : "/account/notifications";
}

export function PushNotificationRegistration() {
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function registerDevice() {
      const firebase = await loadFirebaseMessaging();
      if (!active || !firebase) return;

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (!active || permission !== "granted") return;

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope/",
      });

      const token = await firebase.getToken(firebase.messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!active || !token) return;

      const sessionKey = `broady:fcm-token-registered:${userId}:${token}`;
      if (!window.sessionStorage.getItem(sessionKey)) {
        await registerNotificationDeviceToken({
          token,
          platform: "WEB",
          userAgent: window.navigator.userAgent,
        });
        window.sessionStorage.setItem(sessionKey, "true");
        window.localStorage.setItem(`broady:fcm-token:${userId}`, token);
      }

      unsubscribe = firebase.onMessage(firebase.messaging, (payload) => {
        if (Notification.permission !== "granted" || document.visibilityState === "visible") return;

        const title = payload.notification?.title || "Broady";
        const notification = new Notification(title, {
          body: payload.notification?.body,
          icon: payload.notification?.image || "/BROADY_LOGO.png",
          data: { targetPath: resolveMessageTargetPath(payload) },
        });

        notification.onclick = () => {
          window.focus();
          window.location.assign(resolveMessageTargetPath(payload));
        };
      });
    }

    void registerDevice().catch((error) => {
      console.warn("[notifications] push registration failed", error);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [userId]);

  return null;
}
