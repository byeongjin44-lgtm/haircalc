"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatManWon, formatWon } from "@/lib/settlement/format";
import {
  buildDateString,
  currentMonthKey,
  formatMonthLabel,
  getDaysInMonth,
  getFirstWeekday,
  shiftMonthKey,
} from "@/lib/settlement/month";
import { filterByMonth, groupByDate, summarizeTransactions } from "@/lib/settlement/summary";
import {
  loadMonthlyActualPayout,
  loadTransactions,
  saveMonthlyActualPayout,
} from "@/lib/settlement/storage";
import type { Transaction } from "@/lib/settlement/types";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function SettlementPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [actualPayoutText, setActualPayoutText] = useState("");
  const [payoutSaved, setPayoutSaved] = useState(false);

  useEffect(() => {
    const loaded = loadTransactions();
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions(loaded);
  }, []);

  useEffect(() => {
    const saved = loadMonthlyActualPayout(monthKey);
    // localStorage는 브라우저에서만 접근 가능해 마운트/월 변경 이후에 읽어야 한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActualPayoutText(saved ? String(saved.amount) : "");
    setPayoutSaved(false);
  }, [monthKey]);

  const monthTransactions = useMemo(
    () => (transactions ? filterByMonth(transactions, monthKey) : []),
    [transactions, monthKey]
  );
  const summary = useMemo(
    () => summarizeTransactions(monthTransactions),
    [monthTransactions]
  );
  const dailyGroups = useMemo(
    () => groupByDate(monthTransactions),
    [monthTransactions]
  );

  const actualPayoutAmount =
    actualPayoutText.trim() !== "" ? Number(actualPayoutText) : null;
  const hasActualPayout = actualPayoutAmount !== null && Number.isFinite(actualPayoutAmount);
  const difference = hasActualPayout
    ? actualPayoutAmount! - summary.totalSettlementAmount
    : null;

  function handleSavePayout() {
    const amount = Number(actualPayoutText);
    if (!Number.isFinite(amount)) return;
    saveMonthlyActualPayout(monthKey, amount);
    setPayoutSaved(true);
  }

  const daysInMonth = getDaysInMonth(monthKey);
  const leadingBlanks = getFirstWeekday(monthKey);

  if (!transactions) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
          className="rounded-full px-3 py-1 text-sm text-zinc-500"
          aria-label="이전 달"
        >
          ← 이전달
        </button>
        <h1 className="text-lg font-bold">{formatMonthLabel(monthKey)}</h1>
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
          className="rounded-full px-3 py-1 text-sm text-zinc-500"
          aria-label="다음 달"
        >
          다음달 →
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs text-zinc-500">총매출</p>
          <p className="mt-1 text-lg font-semibold">{formatWon(summary.totalAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">예상 정산액</p>
          <p className="mt-1 text-lg font-semibold">
            {formatWon(summary.totalSettlementAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">실제 지급액</p>
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              placeholder="미입력"
              value={actualPayoutText}
              onChange={(e) => {
                setActualPayoutText(e.target.value);
                setPayoutSaved(false);
              }}
              className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={handleSavePayout}
              className="shrink-0 text-xs text-zinc-500 underline"
            >
              저장
            </button>
          </div>
          {payoutSaved && <p className="mt-0.5 text-[11px] text-zinc-400">저장됨</p>}
        </div>
        <div>
          <p className="text-xs text-zinc-500">차이</p>
          <p className="mt-1 text-lg font-semibold">
            {difference === null ? "-" : formatWon(difference)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-zinc-500">월간 달력</p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-400">
          {WEEKDAY_LABELS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = buildDateString(monthKey, day);
            const dayTransactions = dailyGroups[dateStr] ?? [];
            const daySummary = summarizeTransactions(dayTransactions);

            return (
              <Link
                key={day}
                href={`/settlement/${dateStr}`}
                className="flex h-14 flex-col items-center justify-start gap-0.5 rounded-lg border border-zinc-100 py-1 text-zinc-700"
              >
                <span className="text-[11px]">{day}</span>
                <span className="text-[10px] text-zinc-400">
                  {formatManWon(daySummary.totalAmount)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {formatManWon(daySummary.totalSettlementAmount)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
