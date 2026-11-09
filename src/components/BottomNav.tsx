"use client";
import { CalendarCheck, Dumbbell, LineChart, Settings, Utensils } from "lucide-react";
import Link from "next/link";
import { cx } from "./ui";

const TABS = [
  { href: "/", label: "Today", icon: CalendarCheck },
  { href: "/workout/", label: "Workout", icon: Dumbbell },
  { href: "/meals/", label: "Meals", icon: Utensils },
  { href: "/progress/", label: "Progress", icon: LineChart },
  { href: "/settings/", label: "Settings", icon: Settings },
];

export default function BottomNav({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const h = href.replace(/\/$/, "") || "/";
          const active = h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
