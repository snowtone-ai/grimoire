import type { Metadata, Viewport } from "next";
import { Cinzel } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#14181f" },
  ],
};

export const metadata: Metadata = {
  title: "Grimoire",
  description:
    "クエストを達成して素材を集め、凍てついた調査拠点の植物を育てるADHDフレンドリーなタスク管理PWA",
  applicationName: "Grimoire",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Grimoire",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html
        lang="ja"
        className={`h-full antialiased ${cinzel.variable}`}
        suppressHydrationWarning
      >
        <head>
          <script
            src="https://accounts.google.com/gsi/client"
            async
          />
        </head>
        <body className="min-h-full flex flex-col">
          <PwaRegister />
          {children}
        </body>
      </html>
    </ViewTransitions>
  );
}
