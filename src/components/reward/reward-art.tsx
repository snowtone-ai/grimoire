"use client";

import Image from "next/image";
import { useState } from "react";
import type { DropDef } from "@/lib/domain/drops";

export function RewardArt({
  drop,
  variant,
  className = "object-cover",
}: {
  drop: DropDef;
  variant: "thumb" | "inspect";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (drop.rarity === 8 && drop.photo) {
    return (
      <Image
        src={drop.photo}
        alt={drop.name}
        fill
        sizes={variant === "thumb" ? "120px" : "100vw"}
        className={className}
        priority={variant === "inspect"}
      />
    );
  }

  if (failed) {
    return (
      <span className="flex h-full w-full items-center justify-center text-6xl" aria-hidden>
        {drop.emoji ?? "◇"}
      </span>
    );
  }

  return (
    <picture>
      <source srcSet={`/item-rewards/${variant}/${drop.id}.avif`} type="image/avif" />
      <img
        src={`/item-rewards/${variant}/${drop.id}.webp`}
        alt={drop.name}
        loading={variant === "thumb" ? "lazy" : "eager"}
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    </picture>
  );
}
