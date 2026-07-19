"use client";

import dynamic from "next/dynamic";

const LoadingFallback = () => (
  <div className="flex min-h-dvh items-center justify-center bg-background">
    <p className="text-sm text-muted-foreground">読み込み中...</p>
  </div>
);

const BookScreen = dynamic(
  () =>
    import("@/components/book/book-screen").then((module) => ({
      default: module.BookScreen,
    })),
  { ssr: false, loading: LoadingFallback }
);

export default function BookPage() {
  return <BookScreen />;
}
