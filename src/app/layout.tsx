import type { Metadata, Viewport } from "next";
import { Cinzel } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { GraceParticlesGate } from "@/components/fx/grace-particles-gate";
import { OpenFlourish } from "@/components/fx/open-flourish";
import { DialogBackHistoryBridge } from "@/lib/use-dialog-back-close";
import { TEXT_SIZE_STORAGE_KEY } from "@/lib/text-size";

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
        data-text-size="normal"
        // globals.css sets `scroll-behavior: smooth` for in-page anchors. Without
        // this attribute Next.js cannot tell that apart from a route change, so
        // it animates the scroll-to-top of every navigation — on top of the view
        // transition — and warns about it in dev.
        data-scroll-behavior="smooth"
        suppressHydrationWarning
      >
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var value=localStorage.getItem(${JSON.stringify(TEXT_SIZE_STORAGE_KEY)});document.documentElement.dataset.textSize=value==="large"?"large":"normal"}catch(_){}})()`,
            }}
          />
          <script
            src="https://accounts.google.com/gsi/client"
            async
          />
        </head>
        <body className="min-h-full flex flex-col">
          <DialogBackHistoryBridge />
          <PwaRegister />
          <GraceParticlesGate />
          <OpenFlourish />
          {children}
        </body>
      </html>
    </ViewTransitions>
  );
}
