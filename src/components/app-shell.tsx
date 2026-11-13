"use client";

import { Suspense, useEffect } from "react";
import { registerServiceWorker } from "@/lib/push-client";
import { Toaster } from "@/components/toaster";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { useMobileNav } from "@/lib/use-nav-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar am PC */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2 text-lg font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/favicon.png" alt="" width={28} height={28} className="rounded-lg" />
          {APP_NAME}
        </div>
        <Suspense fallback={<SidebarNav pathname="" />}>
          <SidebarNavLive />
        </Suspense>
      </aside>

      {/* Inhalt */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-32 md:px-8 md:pb-10">
        {children}
      </main>

      <Toaster />

      {/* Untere Leiste am Handy */}
      <Suspense fallback={<MobileNav pathname="" />}>
        <MobileNavLive />
      </Suspense>
    </div>
  );
}

function SidebarNavLive() {
  return <SidebarNav pathname={usePathname()} />;
}

function MobileNavLive() {
  return <MobileNav pathname={usePathname()} />;
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== "" && isActive(pathname, href);
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
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const MOBILE_NAV = useMobileNav();
  return (
    <nav
      style={{
        gridTemplateColumns: `repeat(${MOBILE_NAV.length}, minmax(0, 1fr))`,
        bottom: "max(env(safe-area-inset-bottom), 0.75rem)",
      }}
      className="fixed inset-x-3 z-20 grid rounded-[22px] bg-card/95 py-2 shadow-[0_4px_24px_rgba(92,42,22,0.12)] backdrop-blur md:hidden"
    >
      {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === ""
            ? false
            : href === "/mehr"
              ? pathname === "/mehr" ||
                !MOBILE_NAV.some((i) => i.href !== "/mehr" && isActive(pathname, i.href))
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
  );
}
