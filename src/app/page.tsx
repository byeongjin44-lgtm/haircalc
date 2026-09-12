"use client";

import { useEffect, useState } from "react";
import { formatWon } from "@/lib/settlement/format";
import { currentMonthKey } from "@/lib/settlement/month";
import { filterByMonth, summarizeTransactions } from "@/lib/settlement/summary";
import { loadTransactions } from "@/lib/settlement/storage";
import type { Transaction } from "@/lib/settlement/types";

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    const loaded = loadTransactions();
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions(loaded);
  }, []);

  if (!transactions) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  const monthTransactions = filterByMonth(transactions, currentMonthKey());
  const summary = summarizeTransactions(monthTransactions);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">홈</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">이번 달 예상 정산액</p>
        <p className="mt-1 text-3xl font-bold">
          {formatWon(summary.totalSettlementAmount)}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">이번 달 총매출</p>
          <p className="mt-1 text-lg font-semibold">{formatWon(summary.totalAmount)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">이번 달 거래 건수</p>
          <p className="mt-1 text-lg font-semibold">{summary.transactionCount}건</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">평균 객단가</p>
          <p className="mt-1 text-lg font-semibold">{formatWon(summary.averageAmount)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">평균 정산율</p>
          <p className="mt-1 text-lg font-semibold">
            {Math.round(summary.averageRate * 1000) / 10}%
          </p>
        </div>
      </section>
    </div>
  );
}
