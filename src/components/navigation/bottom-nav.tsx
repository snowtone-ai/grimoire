"use client";

import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { BookOpen, Calendar, Home, Sprout } from "lucide-react";
import { playPage } from "@/lib/sound";

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/all", label: "カレンダー", icon: Calendar },
  { href: "/plant", label: "研究所", icon: Sprout },
  { href: "/book", label: "記録", icon: BookOpen },
] as const;

type NavPath = (typeof NAV_ITEMS)[number]["href"];

/** Mark the html element so CSS picks the page-turn direction, then let the
 * transition Link take over. The marker is cleared after the turn ends. */
let pageTurnTimer = 0;

function markPageTurn(fromPath: string | null, toPath: string) {
  const fromIndex = NAV_ITEMS.findIndex((item) => item.href === fromPath);
  const toIndex = NAV_ITEMS.findIndex((item) => item.href === toPath);
  const root = document.documentElement;
  window.clearTimeout(pageTurnTimer);
  root.dataset.pageTurn = toIndex < fromIndex ? "back" : "fwd";
  pageTurnTimer = window.setTimeout(() => {
    delete root.dataset.pageTurn;
  }, 700);
}

const NAV_PATHS = new Set<string>(NAV_ITEMS.map((item) => item.href));

function isNavPath(path: string): path is NavPath {
  return NAV_PATHS.has(path);
}

export function BottomNav({ currentPath }: { currentPath?: NavPath }) {
  const pathname = usePathname();
  // Sub-pages that are not themselves tabs (e.g. /settings) must not light up a
  // tab they are not on, so an unknown path resolves to "no active item".
  const resolvedPath: NavPath | null =
    currentPath ?? (isNavPath(pathname) ? pathname : null);

  return (
    <nav
      aria-label="メインナビゲーション"
      className="bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-frost/45 to-transparent"
      />
      <div className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === resolvedPath;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (isActive) return;
                playPage();
                markPageTurn(resolvedPath, item.href);
              }}
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
