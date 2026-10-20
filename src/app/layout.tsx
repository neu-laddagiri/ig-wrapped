import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrivacyAnalytics } from "@/components/PrivacyAnalytics";
import { AuthProvider } from "@/contexts/AuthContext";
import { PresentationProvider } from "@/contexts/PresentationContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
  themeColor: "#050509",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <PresentationProvider>{children}</PresentationProvider>
        </AuthProvider>
        {analyticsEnabled && <PrivacyAnalytics />}
      </body>
    </html>
  );
}
