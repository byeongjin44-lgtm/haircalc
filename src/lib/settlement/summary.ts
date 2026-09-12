// Transaction 목록에서 기간별 합계를 계산하는 순수 함수.
// 기존 저장된 snapshot(settlementAmount 등)을 그대로 합산할 뿐,
// 현재 SettlementSettings로 재계산하지 않는다.

import { monthKeyOf } from "./month.ts";
import type { Transaction } from "./types.ts";

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
