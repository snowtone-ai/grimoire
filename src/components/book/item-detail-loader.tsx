"use client";

import dynamic from "next/dynamic";

const LoadingFallback = () => (
  <div className="flex min-h-dvh items-center justify-center bg-background">
    <p className="text-sm text-muted-foreground">読み込み中...</p>
  </div>
);

const ItemDetailScreen = dynamic(
  () =>
    import("@/components/book/item-detail-screen").then((module) => ({
      default: module.ItemDetailScreen,
    })),
  { ssr: false, loading: LoadingFallback }
);

export function ItemDetailLoader({ dropId }: { dropId: string }) {
  return <ItemDetailScreen dropId={dropId} />;
}
