import type { Metadata, Viewport } from "next";
import { Geist_Mono, Grand_Hotel } from "next/font/google";
import { PrivacyAnalytics } from "@/components/PrivacyAnalytics";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresentationProvider } from "@/contexts/PresentationContext";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Script wordmark for the IG Wrapped logo only; the UI uses the system font stack.
const logoScript = Grand_Hotel({
  variable: "--font-logo-script",
  weight: "400",
  subsets: ["latin"],
});

const TITLE = "IG Wrapped — Your Instagram data, decoded";
const DESCRIPTION =
  "A privacy-first Instagram data export analyzer. Parse locally in your browser — optional account save for cross-device progress.";

// Vercel Analytics is opt-in: set NEXT_PUBLIC_ENABLE_ANALYTICS=true to enable.
const analyticsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ANALYTICS?.trim().toLowerCase() === "true";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${logoScript.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a saved light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <PresentationProvider>{children}</PresentationProvider>
        </AuthProvider>
        {analyticsEnabled && <PrivacyAnalytics />}
      </body>
    </html>
  );
}
