"use client";

import { useEffect, useState } from "react";
import { formatSignedWon, formatWon } from "@/lib/settlement/format";
import { currentMonthKey } from "@/lib/settlement/month";
import {
  combinePeriodSummary,
  filterByMonth,
  filterPrepaidEventsByMonth,
  summarizeTransactions,
} from "@/lib/settlement/summary";
import { loadPrepaidEvents, loadTransactions } from "@/lib/settlement/storage";
import type { PrepaidEvent, Transaction } from "@/lib/settlement/types";

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [prepaidEvents, setPrepaidEvents] = useState<PrepaidEvent[] | null>(null);

  useEffect(() => {
    (async () => {
      const [loadedTransactions, loadedPrepaidEvents] = await Promise.all([
        loadTransactions(),
        loadPrepaidEvents(),
      ]);
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setTransactions(loadedTransactions);
      setPrepaidEvents(loadedPrepaidEvents);
    })();
  }, []);

  if (!transactions || !prepaidEvents) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  const monthKey = currentMonthKey();
  const monthTransactions = filterByMonth(transactions, monthKey);
  const monthPrepaidEvents = filterPrepaidEventsByMonth(prepaidEvents, monthKey);
  const combined = combinePeriodSummary(monthTransactions, monthPrepaidEvents);
  const transactionSummary = summarizeTransactions(monthTransactions);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">홈</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">이번 달 예상 정산액</p>
        <p className="mt-1 text-3xl font-bold">
          {formatWon(combined.totalSettlementAmount)}
        </p>
        {combined.prepaidImpact.settlementImpact !== 0 && (
          <p className="mt-1 text-xs text-zinc-400">
            정액권 조정 {formatSignedWon(combined.prepaidImpact.settlementImpact)}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">이번 달 총매출</p>
          <p className="mt-1 text-lg font-semibold">{formatWon(combined.totalAmount)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">이번 달 일반 거래 건수</p>
          <p className="mt-1 text-lg font-semibold">
            {transactionSummary.transactionCount}건
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">평균 객단가</p>
          <p className="mt-1 text-lg font-semibold">
            {formatWon(transactionSummary.averageAmount)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">평균 정산율</p>
          <p className="mt-1 text-lg font-semibold">
            {Math.round(transactionSummary.averageRate * 1000) / 10}%
          </p>
        </div>
      </section>
    </div>
  );
}
