import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Web Genius AI Dashboard — Live Sales, Quotes & References",
  description:
    "AI-powered sales dashboard synced with Google Sheets: month targets, member performance, quotation templates, reference websites and instruction sheets.",
  keywords: ["Sales Dashboard", "AI Insights", "Google Sheets Sync", "Web Genius", "Fiverr Team"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Web Genius AI Dashboard",
    description: "AI-powered sales dashboard synced with Google Sheets: month targets, member performance, quotation templates, reference websites and instruction sheets.",
    siteName: "Web Genius AI Dashboard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Web Genius AI Dashboard",
    description: "AI-powered sales dashboard synced with Google Sheets.",
  },
};

/** Matches the light canvas so mobile browser chrome blends with the page. */
export const viewport: Viewport = {
  themeColor: "#fafaf9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
