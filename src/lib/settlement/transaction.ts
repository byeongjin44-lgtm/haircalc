import { buildTransactionSnapshot, type TransactionInput } from "./engine.ts";
import type { Transaction, SettlementSettings } from "./types.ts";

/** Read the saved final payout, never recalculate from today's settings. */
export function transactionPayout(tx: Transaction): number {
  return tx.withholding3_3Applied ? tx.estimatedPayoutAmount : tx.settlementAmount;
}

export type TransactionEdit = Pick<TransactionInput, "date" | "amount" | "customerType" | "serviceType" | "paymentType" | "memo">;

export function editTransaction(original: Transaction, input: TransactionEdit, updatedAt: string, explicitlyConfirmedRules?: SettlementSettings): Transaction {
  if (!input.date || !Number.isFinite(input.amount) || input.amount <= 0) throw new Error("날짜와 0보다 큰 금액을 입력해주세요.");
  const rules = original.settlementSettingsSnapshot ?? explicitlyConfirmedRules;
  if (!rules) {
    if (input.amount !== original.amount || input.customerType !== original.customerType || input.paymentType !== original.paymentType) {
      throw new Error("당시 정산 규칙이 저장되지 않은 거래입니다. 재계산에 사용할 설정을 먼저 확인해주세요.");
    }
    return { ...original, ...input, updatedAt };
  }
  return buildTransactionSnapshot({ ...input, id: original.id, createdAt: original.createdAt, updatedAt }, rules);
}
