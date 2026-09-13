"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "홈", activePaths: ["/"] },
  { href: "/entry", label: "등록", activePaths: ["/entry"] },
  { href: "/settlement", label: "월정산", activePaths: ["/settlement"] },
  { href: "/prepaid", label: "정액권", activePaths: ["/prepaid"] },
  { href: "/more", label: "더보기", activePaths: ["/more", "/history", "/settings"] },
] as const;

function isPathActive(pathname: string, activePath: string): boolean {
  return activePath === "/" ? pathname === "/" : pathname.startsWith(activePath);
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {NAV_ITEMS.map((item) => {
          const isActive = item.activePaths.some((path) => isPathActive(pathname, path));

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center py-3 text-xs ${
                  isActive ? "font-semibold text-zinc-900" : "text-zinc-500"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
