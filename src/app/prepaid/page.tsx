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
        <Link href="/prepaid/new" className="text-sm text-zinc-500 underline">
          + 정액권 등록
        </Link>
      </div>

      {!passes && <p className="text-sm text-zinc-400">불러오는 중...</p>}

      {passes && passes.length === 0 && (
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
          등록된 정액권이 없습니다.
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
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${isEnded ? "text-zinc-400" : ""}`}>
                      {pass.label || `정액권 (${pass.purchaseDate})`}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isEnded ? "bg-zinc-200 text-zinc-500" : "bg-zinc-900 text-white"
                      }`}
                    >
                      {PREPAID_PASS_STATUS_LABELS[pass.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    구매일 {pass.purchaseDate} · {PREPAID_RECOGNITION_MODE_LABELS[pass.recognitionMode]}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      실결제 {formatWon(pass.paidAmount)} · 사용가능 {formatWon(pass.creditAmount)}
                    </span>
                    <span className={`font-bold ${isEnded ? "text-zinc-400" : ""}`}>
                      잔액 {formatWon(pass.remainingBalance)}
                    </span>
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
