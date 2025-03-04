import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeToggle } from "../components/ThemeToggle";
import { Navigation } from "../components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Video Clipper",
  description: "AI-powered video clipper for social media",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
          <ThemeToggle />
        </Providers>
      </body>
    </html>
  );
} 