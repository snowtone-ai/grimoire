import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1915" },
  ],
};

export const metadata: Metadata = {
  title: "Task Plant",
  description: "ADHDユーザー向けタスク管理 + 植物育成PWA",
  applicationName: "Task Plant",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Task Plant",
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
    <html
      lang="ja"
      className="h-full antialiased"
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
  );
}
