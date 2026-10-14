import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { ServiceWorker } from "@/components/ServiceWorker";
import { NativeApp } from "@/components/NativeApp";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "horospaper — Your day, written in the stars",
  description:
    "A daily Vedic reading shaped by your birth details and the sky above.",
  // Installed on a phone (see manifest.ts; the icon is app/apple-icon.png): its home-screen title.
  appleWebApp: { title: "horospaper", statusBarStyle: "black-translucent" },
};

// The browser bar and Android status bar in the app's own dark background.
export const viewport: Viewport = {
  themeColor: "#101322",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="cosmic-backdrop" aria-hidden="true" />
        {children}
        <Footer />
        <ServiceWorker />
        <NativeApp />
      </body>
    </html>
  );
}
