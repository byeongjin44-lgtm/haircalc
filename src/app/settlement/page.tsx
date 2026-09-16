"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatManWon, formatSignedWon, formatWon } from "@/lib/settlement/format";
import {
  buildDateString,
  currentMonthKey,
  formatMonthLabel,
  getDaysInMonth,
  getFirstWeekday,
  shiftMonthKey,
} from "@/lib/settlement/month";
import {
  combineFullPeriodSummary,
  filterByMonth,
  filterMembershipEventsByMonth,
  filterPrepaidEventsByMonth,
  groupByDate,
  groupMembershipEventsByDate,
  groupPrepaidEventsByDate,
} from "@/lib/settlement/summary";
import {
  loadMembershipEvents,
  loadMonthlyActualPayout,
  loadPrepaidEvents,
  loadTransactions,
  saveMonthlyActualPayout,
} from "@/lib/settlement/storage";
import type { MembershipEvent, PrepaidEvent, Transaction } from "@/lib/settlement/types";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function SettlementPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [prepaidEvents, setPrepaidEvents] = useState<PrepaidEvent[] | null>(null);
  const [membershipEvents, setMembershipEvents] = useState<MembershipEvent[] | null>(null);
  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [actualPayoutText, setActualPayoutText] = useState("");
  const [payoutSaved, setPayoutSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const [loadedTransactions, loadedPrepaidEvents, loadedMembershipEvents] = await Promise.all([
        loadTransactions(),
        loadPrepaidEvents(),
        loadMembershipEvents(),
      ]);
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setTransactions(loadedTransactions);
      setPrepaidEvents(loadedPrepaidEvents);
      setMembershipEvents(loadedMembershipEvents);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await loadMonthlyActualPayout(monthKey);
      // IndexedDB는 브라우저에서만 접근 가능해 마운트/월 변경 이후에 읽어야 한다.

      setActualPayoutText(saved ? String(saved.amount) : "");
      setPayoutSaved(false);
    })();
  }, [monthKey]);

  const monthTransactions = useMemo(
    () => (transactions ? filterByMonth(transactions, monthKey) : []),
    [transactions, monthKey]
  );
  const monthPrepaidEvents = useMemo(
    () => (prepaidEvents ? filterPrepaidEventsByMonth(prepaidEvents, monthKey) : []),
    [prepaidEvents, monthKey]
  );
  const monthMembershipEvents = useMemo(
    () => (membershipEvents ? filterMembershipEventsByMonth(membershipEvents, monthKey) : []),
    [membershipEvents, monthKey]
  );
  const summary = useMemo(
    () => combineFullPeriodSummary(monthTransactions, monthPrepaidEvents, monthMembershipEvents),
    [monthTransactions, monthPrepaidEvents, monthMembershipEvents]
  );
  const dailyTxGroups = useMemo(
    () => groupByDate(monthTransactions),
    [monthTransactions]
  );
  const dailyPrepaidGroups = useMemo(
    () => groupPrepaidEventsByDate(monthPrepaidEvents),
    [monthPrepaidEvents]
  );
  const dailyMembershipGroups = useMemo(
    () => groupMembershipEventsByDate(monthMembershipEvents),
    [monthMembershipEvents]
  );

  const actualPayoutAmount =
    actualPayoutText.trim() !== "" ? Number(actualPayoutText) : null;
  const hasActualPayout = actualPayoutAmount !== null && Number.isFinite(actualPayoutAmount);
  const difference = hasActualPayout
    ? actualPayoutAmount! - summary.totalSettlementAmount
    : null;

  async function handleSavePayout() {
    const amount = Number(actualPayoutText);
    if (!Number.isFinite(amount)) return;
    await saveMonthlyActualPayout(monthKey, amount);
    setPayoutSaved(true);
  }

  const daysInMonth = getDaysInMonth(monthKey);
  const leadingBlanks = getFirstWeekday(monthKey);

  if (!transactions || !prepaidEvents || !membershipEvents) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
          className="min-h-[40px] rounded-full px-3 py-2 text-sm text-zinc-500 active:bg-zinc-100"
          aria-label="이전 달"
        >
          ← 이전달
        </button>
        <h1 className="text-lg font-bold">{formatMonthLabel(monthKey)}</h1>
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
          className="min-h-[40px] rounded-full px-3 py-2 text-sm text-zinc-500 active:bg-zinc-100"
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
          {summary.prepaidImpact.settlementImpact !== 0 && (
            <p className="text-[11px] text-zinc-400">
              정액권 조정 {formatSignedWon(summary.prepaidImpact.settlementImpact)}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-500">실제 지급액</p>
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="미입력"
              value={actualPayoutText}
              onChange={(e) => {
                setActualPayoutText(e.target.value);
                setPayoutSaved(false);
              }}
              className="min-h-[36px] w-full rounded-lg border border-zinc-200 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={handleSavePayout}
              className="min-h-[36px] shrink-0 px-1 text-xs text-zinc-500 underline"
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

      <p className="text-center text-[11px] text-zinc-400">
        이번 달 타 디자이너 사용분을 모두 반영했는지 확인해주세요. 로컬 저장 방식이라
        직접 기록하지 않으면 반영되지 않습니다.
      </p>

      {monthTransactions.length === 0 &&
        monthPrepaidEvents.length === 0 &&
        monthMembershipEvents.length === 0 && (
        <p className="text-center text-xs text-zinc-400">
          이 달에는 등록된 거래가 없어요.{" "}
          <Link href="/entry" className="underline">
            거래 등록하기
          </Link>
        </p>
      )}

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
            const dayTransactions = dailyTxGroups[dateStr] ?? [];
            const dayPrepaidEvents = dailyPrepaidGroups[dateStr] ?? [];
            const dayMembershipEvents = dailyMembershipGroups[dateStr] ?? [];
            const daySummary = combineFullPeriodSummary(
              dayTransactions,
              dayPrepaidEvents,
              dayMembershipEvents
            );

            return (
              <Link
                key={day}
                href={`/settlement/${dateStr}`}
                className="flex h-14 flex-col items-center justify-start gap-0.5 overflow-hidden rounded-lg border border-zinc-100 bg-white py-1 text-zinc-700 shadow-sm active:bg-zinc-100"
              >
                <span className="text-[11px] font-medium">{day}</span>
                <span className="max-w-full truncate text-[9px] text-zinc-400">
                  {formatManWon(daySummary.totalAmount)}
                </span>
                <span className="max-w-full truncate text-[9px] font-semibold text-zinc-600">
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
