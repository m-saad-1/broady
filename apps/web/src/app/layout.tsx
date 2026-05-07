import type { Metadata } from "next";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PushNotificationRegistration } from "@/components/notifications/push-notification-registration";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { QueryProvider } from "@/providers/query-provider";
import { GoogleAuthProvider } from "@/providers/google-auth-provider";
import "./globals.css";

const headingFont = Bebas_Neue({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://broady.pk"),
  title: {
    default: "BROADY | Multi-Brand Fashion Marketplace Pakistan",
    template: "%s | BROADY",
  },
  description:
    "BROADY aggregates verified western fashion labels in Pakistan including Outfitters, Breakout, and Cougar for seamless browsing, comparison, and checkout.",
  keywords: ["Pakistan fashion marketplace", "Outfitters", "Breakout", "Cougar", "western wear Pakistan"],
  manifest: "/manifest.json",
  openGraph: {
    title: "BROADY",
    description: "High-street minimalist fashion marketplace for Pakistan.",
    type: "website",
    locale: "en_PK",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "").trim();

  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${bodyFont.className} min-h-full bg-white text-black`} suppressHydrationWarning>
        <GoogleAuthProvider clientId={googleClientId}>
          <QueryProvider>
            <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(244,244,245,0.7),transparent_35%)]">
              <SiteHeader />
              <div className="flex-1">{children}</div>
              <SiteFooter />
              <ToastViewport />
              <PushNotificationRegistration />
            </div>
          </QueryProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
