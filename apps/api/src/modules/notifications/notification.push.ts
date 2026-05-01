import { JWT } from "google-auth-library";
import { env } from "../../config/env.js";

type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type PushDeliveryResult = {
  ok: boolean;
  token: string;
  error?: string;
  shouldDisableToken?: boolean;
};

let cachedAuthClient: JWT | null = null;
let cachedServiceAccount: FirebaseServiceAccount | null | undefined;

function parseServiceAccountJson(): Partial<FirebaseServiceAccount> {
  if (!env.firebaseServiceAccountJson.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(env.firebaseServiceAccountJson) as {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };

    return {
      projectId: parsed.project_id || parsed.projectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey: parsed.private_key || parsed.privateKey,
    };
  } catch {
    return {};
  }
}

function resolveServiceAccount(): FirebaseServiceAccount | null {
  if (cachedServiceAccount !== undefined) {
    return cachedServiceAccount;
  }

  const fromJson = parseServiceAccountJson();
  const projectId = fromJson.projectId || env.firebaseProjectId;
  const clientEmail = fromJson.clientEmail || env.firebaseClientEmail;
  const privateKey = (fromJson.privateKey || env.firebasePrivateKey).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    cachedServiceAccount = null;
    return cachedServiceAccount;
  }

  cachedServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };
  return cachedServiceAccount;
}

async function getAccessToken() {
  const serviceAccount = resolveServiceAccount();
  if (!serviceAccount) {
    throw new Error("Firebase service account is not configured");
  }

  if (!cachedAuthClient) {
    cachedAuthClient = new JWT({
      email: serviceAccount.clientEmail,
      key: serviceAccount.privateKey,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
  }

  const accessToken = await cachedAuthClient.getAccessToken();
  if (!accessToken.token) {
    throw new Error("Unable to create Firebase access token");
  }

  return {
    projectId: serviceAccount.projectId,
    token: accessToken.token,
  };
}

function toFcmData(input: Record<string, unknown> | undefined) {
  if (!input) return undefined;

  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
  );
}

function shouldDisableToken(errorBody: string) {
  return /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/i.test(errorBody);
}

function resolveWebPushLink(targetPath: unknown) {
  if (typeof targetPath === "string" && /^https?:\/\//i.test(targetPath)) {
    return targetPath;
  }

  const path = typeof targetPath === "string" && targetPath.startsWith("/") ? targetPath : "/account/notifications";
  return `${env.webAppUrl.replace(/\/$/, "")}${path}`;
}

export async function sendPushNotification(input: {
  token: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}): Promise<PushDeliveryResult> {
  const auth = await getAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: input.token,
        notification: {
          title: input.title,
          body: input.message,
        },
        data: toFcmData(input.data),
        webpush: {
          fcmOptions: {
            link: resolveWebPushLink(input.data?.targetPath),
          },
        },
      },
    }),
  });

  if (response.ok) {
    return { ok: true, token: input.token };
  }

  const body = await response.text();
  return {
    ok: false,
    token: input.token,
    error: `FCM rejected request (${response.status}): ${body.slice(0, 240)}`,
    shouldDisableToken: shouldDisableToken(body),
  };
}
