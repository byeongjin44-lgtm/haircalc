// Transaction 목록에서 기간별 합계를 계산하는 순수 함수.
// 기존 저장된 snapshot(settlementAmount 등)을 그대로 합산할 뿐,
// 현재 SettlementSettings로 재계산하지 않는다.

import { monthKeyOf } from "./month.ts";
import type { MembershipEvent, PrepaidEvent, Transaction } from "./types.ts";

export interface PeriodSummary {
  totalAmount: number;
  totalSettlementAmount: number;
  transactionCount: number;
  /** 평균 객단가 (거래 1건당 평균 결제금액) */
  averageAmount: number;
  /** 평균 정산율 = 총 정산액 / 총매출 (0~1) */
  averageRate: number;
}

export function filterByMonth(
  transactions: Transaction[],
  monthKey: string
): Transaction[] {
  return transactions.filter((tx) => monthKeyOf(tx.date) === monthKey);
}

export function filterByDate(
  transactions: Transaction[],
  date: string
): Transaction[] {
  return transactions.filter((tx) => tx.date === date);
}

export function groupByDate(
  transactions: Transaction[]
): Record<string, Transaction[]> {
  const grouped: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    (grouped[tx.date] ??= []).push(tx);
  }
  return grouped;
}

export function summarizeTransactions(transactions: Transaction[]): PeriodSummary {
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalSettlementAmount = transactions.reduce(
    (sum, tx) => sum + tx.settlementAmount,
    0
  );
  const transactionCount = transactions.length;
  const averageAmount =
    transactionCount > 0 ? Math.round(totalAmount / transactionCount) : 0;
  const averageRate = totalAmount > 0 ? totalSettlementAmount / totalAmount : 0;

  return {
    totalAmount,
    totalSettlementAmount,
    transactionCount,
    averageAmount,
    averageRate,
  };
}

// --- 정액권 이벤트 집계 ---
// PrepaidEvent도 Transaction과 동일하게 "이벤트 발생일(date)" 기준으로 월/일에 귀속시킨다.
// 과거 이벤트(예: 구매)를 수정하지 않고, 나중에 생긴 이벤트(예: 타디자이너 사용)는
// 그 이벤트가 실제로 발생한 달에만 영향을 준다.

export function filterPrepaidEventsByMonth(
  events: PrepaidEvent[],
  monthKey: string
): PrepaidEvent[] {
  return events.filter((event) => monthKeyOf(event.date) === monthKey);
}

export function filterPrepaidEventsByDate(
  events: PrepaidEvent[],
  date: string
): PrepaidEvent[] {
  return events.filter((event) => event.date === date);
}

export function groupPrepaidEventsByDate(
  events: PrepaidEvent[]
): Record<string, PrepaidEvent[]> {
  const grouped: Record<string, PrepaidEvent[]> = {};
  for (const event of events) {
    (grouped[event.date] ??= []).push(event);
  }
  return grouped;
}

export interface PrepaidImpactSummary {
  salesImpact: number;
  settlementImpact: number;
}

export function summarizePrepaidEvents(events: PrepaidEvent[]): PrepaidImpactSummary {
  return {
    salesImpact: events.reduce((sum, event) => sum + event.salesImpact, 0),
    settlementImpact: events.reduce((sum, event) => sum + event.settlementImpact, 0),
  };
}

/**
 * 일반 Transaction 합계 + 정액권 이벤트 영향을 더한 최종 매출/정산액.
 * 일반 거래 snapshot과 정액권 이벤트 snapshot을 그대로 합산할 뿐, 어느 쪽도 재계산하지 않는다.
 */
export interface CombinedPeriodSummary {
  transactionSummary: PeriodSummary;
  prepaidImpact: PrepaidImpactSummary;
  totalAmount: number;
  totalSettlementAmount: number;
}

export function combinePeriodSummary(
  transactions: Transaction[],
  prepaidEvents: PrepaidEvent[]
): CombinedPeriodSummary {
  const transactionSummary = summarizeTransactions(transactions);
  const prepaidImpact = summarizePrepaidEvents(prepaidEvents);

  return {
    transactionSummary,
    prepaidImpact,
    totalAmount: transactionSummary.totalAmount + prepaidImpact.salesImpact,
    totalSettlementAmount:
      transactionSummary.totalSettlementAmount + prepaidImpact.settlementImpact,
  };
}

// --- 회원권 이벤트 집계 ---
// 정액권과 동일한 원칙 — "이벤트 발생일(date)" 기준으로 월/일에 귀속시키고, 과거 이벤트는
// 수정하지 않는다.

export function filterMembershipEventsByMonth(
  events: MembershipEvent[],
  monthKey: string
): MembershipEvent[] {
  return events.filter((event) => monthKeyOf(event.date) === monthKey);
}

export function filterMembershipEventsByDate(
  events: MembershipEvent[],
  date: string
): MembershipEvent[] {
  return events.filter((event) => event.date === date);
}

export function groupMembershipEventsByDate(
  events: MembershipEvent[]
): Record<string, MembershipEvent[]> {
  const grouped: Record<string, MembershipEvent[]> = {};
  for (const event of events) {
    (grouped[event.date] ??= []).push(event);
  }
  return grouped;
}

export interface MembershipImpactSummary {
  salesImpact: number;
  settlementImpact: number;
}

export function summarizeMembershipEvents(events: MembershipEvent[]): MembershipImpactSummary {
  return {
    salesImpact: events.reduce((sum, event) => sum + event.salesImpact, 0),
    settlementImpact: events.reduce((sum, event) => sum + event.settlementImpact, 0),
  };
}

/**
 * 일반 Transaction + 정액권 이벤트 + 회원권 이벤트를 모두 합친 최종 매출/정산액.
 * 별도의 월정산 계산 공식을 새로 만들지 않고 combinePeriodSummary(거래+정액권)에
 * 회원권 영향만 더 얹는 방식으로 확장한다 — 세 원장 중 어느 것도 재계산하지 않는다.
 */
export interface FullPeriodSummary extends CombinedPeriodSummary {
  membershipImpact: MembershipImpactSummary;
}

export function combineFullPeriodSummary(
  transactions: Transaction[],
  prepaidEvents: PrepaidEvent[],
  membershipEvents: MembershipEvent[]
): FullPeriodSummary {
  const combined = combinePeriodSummary(transactions, prepaidEvents);
  const membershipImpact = summarizeMembershipEvents(membershipEvents);

  return {
    ...combined,
    membershipImpact,
    totalAmount: combined.totalAmount + membershipImpact.salesImpact,
    totalSettlementAmount: combined.totalSettlementAmount + membershipImpact.settlementImpact,
  };
}
