"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  PREPAID_EVENT_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/settlement/labels";
import { formatSignedWon, formatWon } from "@/lib/settlement/format";
import {
  combinePeriodSummary,
  filterByDate,
  filterPrepaidEventsByDate,
} from "@/lib/settlement/summary";
import { loadPrepaidEvents, loadPrepaidPasses, loadTransactions } from "@/lib/settlement/storage";
import type { PrepaidEvent, PrepaidPass, Transaction } from "@/lib/settlement/types";

export default function DailyDetailPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;

  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [prepaidEvents, setPrepaidEvents] = useState<PrepaidEvent[] | null>(null);
  const [prepaidPasses, setPrepaidPasses] = useState<PrepaidPass[]>([]);

  useEffect(() => {
    (async () => {
      const [loadedTransactions, loadedPrepaidEvents, loadedPrepaidPasses] = await Promise.all([
        loadTransactions(),
        loadPrepaidEvents(),
        loadPrepaidPasses(),
      ]);
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setTransactions(loadedTransactions);
      setPrepaidEvents(loadedPrepaidEvents);
      setPrepaidPasses(loadedPrepaidPasses);
    })();
  }, []);

  if (!transactions || !prepaidEvents) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  const dayTransactions = filterByDate(transactions, date).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const dayPrepaidEvents = filterPrepaidEventsByDate(prepaidEvents, date).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const summary = combinePeriodSummary(dayTransactions, dayPrepaidEvents);

  function passLabelOf(event: PrepaidEvent): string {
    const pass = prepaidPasses.find((p) => p.id === event.prepaidPassId);
    return pass?.label || "정액권";
  }

  const hasAny = dayTransactions.length > 0 || dayPrepaidEvents.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/settlement" className="text-sm text-zinc-500">
        ← 월정산으로
      </Link>

      <h1 className="text-xl font-bold">{date}</h1>

      <section className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs text-zinc-500">당일 총매출</p>
          <p className="mt-1 text-lg font-semibold">{formatWon(summary.totalAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">당일 예상 정산액</p>
          <p className="mt-1 text-lg font-semibold">
            {formatWon(summary.totalSettlementAmount)}
          </p>
        </div>
      </section>

      {!hasAny && (
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
          이 날짜에 등록된 내역이 없습니다.
        </div>
      )}

      {dayTransactions.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-500">일반 시술</p>
          <ul className="flex flex-col gap-2">
            {dayTransactions.map((tx) => (
              <li key={tx.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="text-xs text-zinc-500">
                    {CUSTOMER_TYPE_LABELS[tx.customerType]} ·{" "}
                    {SERVICE_TYPE_LABELS[tx.serviceType]} ·{" "}
                    {PAYMENT_TYPE_LABELS[tx.paymentType]}
                  </span>
                  <span className="font-semibold tabular-nums">{formatWon(tx.amount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>적용 인센티브율 {Math.round(tx.commissionRateSnapshot * 100)}%</span>
                  <span>정산액 {formatWon(tx.settlementAmount)}</span>
                </div>
                {tx.memo && <p className="mt-1 text-xs text-zinc-400">{tx.memo}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dayPrepaidEvents.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-500">정액권</p>
          <ul className="flex flex-col gap-2">
            {dayPrepaidEvents.map((event) => (
              <li key={event.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="truncate text-xs text-zinc-500">
                    {passLabelOf(event)} · {PREPAID_EVENT_TYPE_LABELS[event.type]}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatSignedWon(event.salesImpact)}
                  </span>
                </div>
                {event.settlementImpact !== 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    정산 {formatSignedWon(event.settlementImpact)}
                  </p>
                )}
                {event.memo && <p className="mt-1 text-xs text-zinc-400">{event.memo}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
