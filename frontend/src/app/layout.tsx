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

// Locked positioning (HN title + homepage first line + social unfurl). The
// description is the one verifiable claim: names the three modalities.
const TITLE = "BiOS: Design biology in plain English";
const DESCRIPTION =
  "Describe a protein, gene, or CRISPR guide in plain English. BiOS designs it, scores it against the closest natural relatives from GenBank, and gives you a shareable permalink.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "BiOS",
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "BiOS",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
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
