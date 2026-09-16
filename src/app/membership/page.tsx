"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MEMBERSHIP_PASS_STATUS_LABELS,
  MEMBERSHIP_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon } from "@/lib/settlement/format";
import { loadMembershipPasses } from "@/lib/settlement/storage";
import type { MembershipPass } from "@/lib/settlement/types";

export default function MembershipListPage() {
  const [passes, setPasses] = useState<MembershipPass[] | null>(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadMembershipPasses();
      const sorted = [...loaded].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setPasses(sorted);
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/prepaid" className="text-sm text-zinc-500">
            정액권
          </Link>
          <span className="text-sm text-zinc-300">/</span>
          <h1 className="text-xl font-bold">회원권</h1>
        </div>
        <Link
          href="/membership/new"
          className="min-h-[36px] rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white"
        >
          + 회원권 등록
        </Link>
      </div>

      {!passes && <p className="text-sm text-zinc-400">불러오는 중...</p>}

      {passes && passes.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-400">등록된 회원권이 없습니다.</p>
          <Link
            href="/membership/new"
            className="min-h-[48px] rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
          >
            첫 회원권 등록
          </Link>
        </div>
      )}

      {passes && passes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passes.map((pass) => {
            const isEnded = pass.status !== "ACTIVE";

            return (
              <li key={pass.id}>
                <Link
                  href={`/membership/${pass.id}`}
                  className={`block rounded-2xl p-4 shadow-sm ${
                    isEnded ? "bg-zinc-100" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* 금액보다 남은 횟수를 더 눈에 띄게 보여준다. */}
                    <span
                      className={`text-xl font-bold tabular-nums ${
                        isEnded ? "text-zinc-400" : "text-zinc-900"
                      }`}
                    >
                      {pass.remainingCount} / {pass.totalCount}회 남음
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        isEnded ? "bg-zinc-200 text-zinc-500" : "bg-zinc-900 text-white"
                      }`}
                    >
                      {MEMBERSHIP_PASS_STATUS_LABELS[pass.status]}
                    </span>
                  </div>
                  <div
                    className={`mt-1 truncate text-sm font-medium ${
                      isEnded ? "text-zinc-400" : "text-zinc-700"
                    }`}
                  >
                    {pass.label}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    실결제 {formatWon(pass.paidAmount)} ·{" "}
                    {MEMBERSHIP_RECOGNITION_MODE_LABELS[pass.recognitionMode]}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
