import { Heart } from "lucide-react";

export type GrimoEmotionMarkKind = "heart" | "exclamation";

type GrimoEmotionMarkProps = {
  kind: GrimoEmotionMarkKind;
  className?: string;
};

/**
 * Decorative emotion marks shared by Grimo companions.  The heart keeps the
 * existing Lucide shape; the exclamation is intentionally authored as a soft
 * rounded mark rather than a warning badge so it reads as a character's
 * feeling, not an application alert.
 */
export function GrimoEmotionMark({ kind, className }: GrimoEmotionMarkProps) {
  if (kind === "heart") {
    return <Heart className={className} fill="currentColor" aria-hidden="true" focusable="false" />;
  }

  return (
    <svg
      className={className}
      viewBox="0 0 48 72"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 4c-4.7 0-8.15 3.25-7.76 7.42l2.62 30.35c.25 2.88 2.39 4.98 5.14 4.98s4.89-2.1 5.14-4.98l2.62-30.35C32.15 7.25 28.7 4 24 4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="59.5" r="5.45" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}
