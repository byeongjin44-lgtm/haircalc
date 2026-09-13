"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatSignedWon, formatWon } from "@/lib/settlement/format";
import { currentMonthKey } from "@/lib/settlement/month";
import {
  combinePeriodSummary,
  filterByMonth,
  filterPrepaidEventsByMonth,
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

  if (transactions.length === 0 && prepaidEvents.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">홈</h1>
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-500">아직 등록된 매출이 없어요</p>
          <Link
            href="/entry"
            className="min-h-[48px] rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
          >
            첫 거래 등록
          </Link>
        </div>
      </div>
    );
  }

  const monthKey = currentMonthKey();
  const monthTransactions = filterByMonth(transactions, monthKey);
  const monthPrepaidEvents = filterPrepaidEventsByMonth(prepaidEvents, monthKey);
  const combined = combinePeriodSummary(monthTransactions, monthPrepaidEvents);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">홈</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">이번 달 예상 정산액</p>
        <p className="mt-1 break-words text-4xl font-bold tabular-nums">
          {formatWon(combined.totalSettlementAmount)}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs text-zinc-500">이번 달 총매출</p>
        <p className="mt-1 break-words text-2xl font-bold tabular-nums">
          {formatWon(combined.totalAmount)}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">거래 건수</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {monthTransactions.length}건
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">정액권 영향</p>
          <p className="mt-1 break-words text-base font-semibold tabular-nums">
            {formatSignedWon(combined.prepaidImpact.settlementImpact)}
          </p>
        </div>
      </section>
    </div>
  );
}
