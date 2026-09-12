"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/entry", label: "거래등록" },
  { href: "/history", label: "내역" },
  { href: "/settlement", label: "월정산" },
  { href: "/settings", label: "설정" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 text-xs ${
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
