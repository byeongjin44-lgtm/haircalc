"use client";

import { useEffect, useState } from "react";
import {
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon } from "@/lib/settlement/format";
import { loadTransactions } from "@/lib/settlement/storage";
import type { Transaction } from "@/lib/settlement/types";

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    const loaded = loadTransactions();
    const sorted = [...loaded].sort((a, b) =>
      b.date === a.date
        ? b.createdAt.localeCompare(a.createdAt)
        : b.date.localeCompare(a.date)
    );
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions(sorted);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">내역</h1>

      {!transactions && (
        <p className="text-sm text-zinc-400">불러오는 중...</p>
      )}

      {transactions && transactions.length === 0 && (
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
          아직 등록된 거래가 없습니다.
        </div>
      )}

      {transactions && transactions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <li key={tx.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">{tx.date}</span>
                <span className="font-semibold">{formatWon(tx.settlementAmount)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-zinc-500">
                <span>{CUSTOMER_TYPE_LABELS[tx.customerType]}</span>
                <span>·</span>
                <span>{SERVICE_TYPE_LABELS[tx.serviceType]}</span>
                <span>·</span>
                <span>{PAYMENT_TYPE_LABELS[tx.paymentType]}</span>
                <span>·</span>
                <span>결제 {formatWon(tx.amount)}</span>
              </div>
              {tx.withholding3_3Applied && (
                <p className="mt-1 text-xs text-zinc-400">
                  예상 지급액 (3.3% 반영) {formatWon(tx.estimatedPayoutAmount)}
                </p>
              )}
              {tx.memo && <p className="mt-1 text-xs text-zinc-400">{tx.memo}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
