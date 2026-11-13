"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NAV_ITEMS } from "@/lib/nav";
import { useBarHrefs } from "@/lib/use-nav-bar";

export default function MehrPage() {
  const bar = useBarHrefs();
  const items = NAV_ITEMS.filter((i) => !bar.includes(i.href));

  return (
    <>
      <PageHeader title="Mehr" />
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/5"
          >
            <Icon size={20} className="text-accent" />
            <span className="flex-1">{label}</span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
    </>
  );
}
