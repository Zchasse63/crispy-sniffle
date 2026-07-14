import type { Metadata } from "next";
import { Big_Shoulders, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { HydrationGate } from "@/components/ui/HydrationGate";
import { SiteHeader } from "@/components/SiteHeader";
import { ShortlistDrawer } from "@/components/shortlist/ShortlistDrawer";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastViewport } from "@/components/ui/Toast";

const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Scout — Find your fit.",
  description:
    "AI-powered gym discovery. Scout scans the landscape of gyms and surfaces the right fit for you — based on what matters most.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* First tab stop on every page: visually hidden until focused, then
            jumps keyboard/screen-reader users past the header straight to
            each page's <main id="main-content">. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-paper focus:shadow-lg"
        >
          Skip to main content
        </a>
        <HydrationGate>
          <SiteHeader />
          {children}
          <SiteFooter />
          <ShortlistDrawer />
        </HydrationGate>
        {/* Ephemeral — no rehydration race, so it mounts outside HydrationGate. */}
        <ToastViewport />
      </body>
    </html>
  );
}
