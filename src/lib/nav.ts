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

/** Untere Leiste am Handy: die vier wichtigsten + „Mehr“. */
export const MOBILE_NAV: NavItem[] = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[2],
  NAV_ITEMS[3],
  { href: "/mehr", label: "Mehr", icon: MoreHorizontal },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
