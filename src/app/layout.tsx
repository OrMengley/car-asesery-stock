import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "ANTIGRAVITY - Inventory & Stock Management",
  description: "Modern, lightweight inventory management application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={GeistMono.className} suppressHydrationWarning>
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
