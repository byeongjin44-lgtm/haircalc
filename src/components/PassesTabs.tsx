"use client";

import Link from "next/link";

/**
 * /prepaid, /membership 상단 공통 segmented navigation. 두 기능이 같은 레벨의
 * 관리 기능처럼 보이게 한다 (새 /passes route는 만들지 않고, 각 화면 상단에만 둔다).
 */
export default function PassesTabs({ active }: { active: "prepaid" | "membership" }) {
  return (
    <div className="flex gap-1 rounded-full bg-zinc-100 p-1 text-sm">
      <Link
        href="/prepaid"
        className={`flex-1 rounded-full py-1.5 text-center font-semibold ${
          active === "prepaid" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
        }`}
      >
        정액권
      </Link>
      <Link
        href="/membership"
        className={`flex-1 rounded-full py-1.5 text-center font-semibold ${
          active === "membership" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
        }`}
      >
        회원권
      </Link>
    </div>
  );
}
