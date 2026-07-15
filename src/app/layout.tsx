import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

const analyticsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_ANALYTICS?.trim().toLowerCase() === "true";

export const metadata: Metadata = {
  title: "IG Wrapped — Your Instagram data, decoded",
  description:
    "A privacy-first Instagram data export analyzer. Parse locally in your browser — optional account save for cross-device progress.",
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
        {analyticsEnabled && <Analytics />}
      </body>
    </html>
  );
}
