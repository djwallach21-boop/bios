import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BiOS: Design biology in plain language",
  description:
    "Describe what you want a protein to do. BiOS returns candidate sequences, a confidence score, and the closest natural relatives from GenBank. Open source.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Ambient stage behind everything: a faint floor glow + sub-perceptual
            dot grid, then filmic grain. Fixed, pointer-events-none, behind all
            content. */}
        <div
          aria-hidden
          className="stage-field pointer-events-none fixed inset-0 -z-10"
        />
        <div
          aria-hidden
          className="grain pointer-events-none fixed inset-0 -z-10"
        />
        {children}
      </body>
    </html>
  );
}
