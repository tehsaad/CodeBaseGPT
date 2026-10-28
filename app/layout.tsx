import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

const siteUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "CodeBaseGPT — understand any codebase, with evidence", template: "%s · CodeBaseGPT" },
  description:
    "Import a repository, explore its real architecture in an interactive Atlas, ask Gemma questions answered with file-and-line citations, and get unstuck with web research.",
  applicationName: "CodeBaseGPT",
  openGraph: {
    type: "website",
    siteName: "CodeBaseGPT",
    title: "CodeBaseGPT — understand any codebase, with evidence",
    description: "Interactive Codebase Atlas, cited AI answers, and Student Stuck Mode with real web research.",
  },
  twitter: { card: "summary_large_image", title: "CodeBaseGPT", description: "Understand any codebase, with evidence." },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b1020" }, { media: "(prefers-color-scheme: light)", color: "#f6f7fb" }],
};

const themeScript = `try{var t=localStorage.getItem('cbg-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${plex.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
