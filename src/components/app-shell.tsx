"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { MOBILE_NAV, NAV_ITEMS, isActive } from "@/lib/nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar am PC */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-semibold">{APP_NAME}</div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-muted hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Inhalt */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
        {children}
      </main>

      {/* Untere Leiste am Handy */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card/95 pt-2 backdrop-blur md:hidden">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/mehr"
              ? pathname === "/mehr" ||
                !MOBILE_NAV.some(
                  (i) => i.href !== "/mehr" && isActive(pathname, i.href),
                )
              : isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 text-[11px] ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
