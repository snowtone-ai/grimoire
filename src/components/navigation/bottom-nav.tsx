"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Leaf } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/all", label: "カレンダー", icon: Calendar },
  { href: "/plant", label: "植物", icon: Leaf },
] as const;

export function BottomNav({ currentPath }: { currentPath?: "/" | "/all" | "/plant" }) {
  const pathname = usePathname();
  const resolvedPath = currentPath ?? (pathname === "/all" || pathname === "/plant" ? pathname : "/");

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === resolvedPath;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="group flex flex-1 flex-col items-center gap-0.5 pt-2 pb-2.5"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300 ease-spring group-active:scale-90 ${
                  isActive ? "bg-brand-soft text-brand" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} />
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  isActive ? "text-brand" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
