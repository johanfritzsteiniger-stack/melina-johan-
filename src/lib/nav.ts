import {
  CalendarDays,
  Film,
  Home,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  Settings,
  Swords,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Alle Bereiche der App (Sidebar am PC, „Mehr“-Seite am Handy). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Start", icon: Home },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/battles", label: "Battles", icon: Trophy },
  { href: "/listen", label: "Listen", icon: ListChecks },
  { href: "/ausgaben", label: "Ausgaben", icon: Wallet },
  { href: "/ideen", label: "Ideen", icon: Lightbulb },
  { href: "/watchlist", label: "Watchlist", icon: Film },
  { href: "/wetten", label: "Wetten", icon: Swords },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export const MORE_ITEM: NavItem = { href: "/mehr", label: "Mehr", icon: MoreHorizontal };

/** Bereiche, die in die untere Leiste dürfen (Einstellungen bleibt unter „Mehr“). */
export const BAR_CHOICES = NAV_ITEMS.filter((i) => i.href !== "/einstellungen");
export const DEFAULT_BAR = ["/", "/kalender", "/battles", "/listen"];
export const BAR_SIZE = 4;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
