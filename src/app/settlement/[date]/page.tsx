"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon } from "@/lib/settlement/format";
import { filterByDate, summarizeTransactions } from "@/lib/settlement/summary";
import { loadTransactions } from "@/lib/settlement/storage";
import type { Transaction } from "@/lib/settlement/types";

export default function DailyDetailPage() {
  const params = useParams<{ date: string }>();
  const date = params.date;

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

  const dayTransactions = filterByDate(transactions, date).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const summary = summarizeTransactions(dayTransactions);

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

      {dayTransactions.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
          이 날짜에 등록된 거래가 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {dayTransactions.map((tx) => (
            <li key={tx.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {CUSTOMER_TYPE_LABELS[tx.customerType]} ·{" "}
                  {SERVICE_TYPE_LABELS[tx.serviceType]} ·{" "}
                  {PAYMENT_TYPE_LABELS[tx.paymentType]}
                </span>
                <span className="font-semibold">{formatWon(tx.amount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                <span>적용 인센티브율 {Math.round(tx.commissionRateSnapshot * 100)}%</span>
                <span>정산액 {formatWon(tx.settlementAmount)}</span>
              </div>
              {tx.memo && <p className="mt-1 text-xs text-zinc-400">{tx.memo}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
