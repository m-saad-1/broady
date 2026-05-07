"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { createContext, ReactNode, useContext } from "react";

type GoogleAuthConfigValue = {
  isConfigured: boolean;
};

const GoogleAuthConfigContext = createContext<GoogleAuthConfigValue>({
  isConfigured: false,
});

export function useGoogleAuthConfig() {
  return useContext(GoogleAuthConfigContext);
}

export function GoogleAuthProvider({
  children,
  clientId,
}: {
  children: ReactNode;
  clientId?: string;
}) {
  const normalizedClientId = (clientId || "").trim();
  const configValue: GoogleAuthConfigValue = {
    isConfigured: Boolean(normalizedClientId),
  };

  if (!normalizedClientId) {
    return <GoogleAuthConfigContext.Provider value={configValue}>{children}</GoogleAuthConfigContext.Provider>;
  }

  return (
    <GoogleAuthConfigContext.Provider value={configValue}>
      <GoogleOAuthProvider clientId={normalizedClientId}>
        {/* Debug: log clientId and origin to console so we can verify runtime values */}
        <DebugClientId clientId={normalizedClientId} />
        {children}
      </GoogleOAuthProvider>
    </GoogleAuthConfigContext.Provider>
  );
}

function DebugClientId({ clientId }: { clientId: string }) {
  // Log on client to confirm runtime values
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { useEffect } = require("react");
  useEffect(() => {
    try {
      // @ts-ignore
      console.info("[GOOGLE_OAUTH_DEBUG] clientId:", clientId);
      // @ts-ignore
      console.info("[GOOGLE_OAUTH_DEBUG] origin:", window?.location?.origin);
    } catch (e) {
      // ignore
    }
  }, []);

  return null;
}
