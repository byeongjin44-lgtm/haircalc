"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PREPAID_PASS_STATUS_LABELS,
  PREPAID_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon } from "@/lib/settlement/format";
import { loadPrepaidPasses } from "@/lib/settlement/storage";
import type { PrepaidPass } from "@/lib/settlement/types";

export default function PrepaidListPage() {
  const [passes, setPasses] = useState<PrepaidPass[] | null>(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadPrepaidPasses();
      const sorted = [...loaded].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setPasses(sorted);
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">정액권</h1>
        <Link
          href="/prepaid/new"
          className="min-h-[36px] rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white"
        >
          + 정액권 등록
        </Link>
      </div>

      {!passes && <p className="text-sm text-zinc-400">불러오는 중...</p>}

      {passes && passes.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-400">등록된 정액권이 없습니다.</p>
          <Link
            href="/prepaid/new"
            className="min-h-[48px] rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
          >
            첫 정액권 등록
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
                  href={`/prepaid/${pass.id}`}
                  className={`block rounded-2xl p-4 shadow-sm ${
                    isEnded ? "bg-zinc-100" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`break-all text-xl font-bold tabular-nums ${
                        isEnded ? "text-zinc-400" : "text-zinc-900"
                      }`}
                    >
                      {formatWon(pass.remainingBalance)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        isEnded ? "bg-zinc-200 text-zinc-500" : "bg-zinc-900 text-white"
                      }`}
                    >
                      {PREPAID_PASS_STATUS_LABELS[pass.status]}
                    </span>
                  </div>
                  <div
                    className={`mt-1 truncate text-sm font-medium ${
                      isEnded ? "text-zinc-400" : "text-zinc-700"
                    }`}
                  >
                    {pass.label || `정액권 (${pass.purchaseDate})`}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    실결제 {formatWon(pass.paidAmount)} · 사용가능 {formatWon(pass.creditAmount)} ·{" "}
                    {PREPAID_RECOGNITION_MODE_LABELS[pass.recognitionMode]}
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
