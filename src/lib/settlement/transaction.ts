import type { Transaction } from "./types.ts";

/** Read the saved final payout, never recalculate from today's settings. */
export function transactionPayout(tx: Transaction): number {
  return tx.withholding3_3Applied ? tx.estimatedPayoutAmount : tx.settlementAmount;
}
