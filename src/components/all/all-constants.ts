import { type Category } from "@/lib/db";

export const categoryConfig = {
  job: { label: "就活", bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  university: { label: "大学", bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  life: { label: "生活", bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
} as const;

export const CATEGORY_FILTERS: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "job", label: "就活" },
  { value: "university", label: "大学" },
  { value: "life", label: "生活" },
];
