import type { Category } from "@/lib/db";

/* Category colors are semantic tokens (globals.css) so every surface adapts
 * to light/dark automatically. `text-background` on active chips keeps text
 * readable in both schemes: light bg -> white text, dark bg -> dark text. */
export const CATEGORY_CONFIG: Record<
  Category,
  {
    label: string;
    bg: string;
    text: string;
    dot: string;
    active: string;
    outline: string;
  }
> = {
  job: {
    label: "就活",
    bg: "bg-cat-job-soft",
    text: "text-cat-job",
    dot: "bg-cat-job",
    active: "border-cat-job bg-cat-job text-background",
    outline: "border-cat-job text-cat-job",
  },
  university: {
    label: "大学",
    bg: "bg-cat-university-soft",
    text: "text-cat-university",
    dot: "bg-cat-university",
    active: "border-cat-university bg-cat-university text-background",
    outline: "border-cat-university text-cat-university",
  },
  life: {
    label: "生活",
    bg: "bg-cat-life-soft",
    text: "text-cat-life",
    dot: "bg-cat-life",
    active: "border-cat-life bg-cat-life text-background",
    outline: "border-cat-life text-cat-life",
  },
};

export const CATEGORY_LIST: { value: Category; label: string }[] = [
  { value: "job", label: "就活" },
  { value: "university", label: "大学" },
  { value: "life", label: "生活" },
];
