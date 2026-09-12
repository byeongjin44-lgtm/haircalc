// 로컬 저장 (localStorage) 전용. 서버/외부 DB 없이 브라우저에만 데이터를 유지한다.

import { createDefaultSettlementSettings } from "./engine.ts";
import type { MonthlyActualPayout, SettlementSettings, Transaction } from "./types.ts";

const SETTINGS_KEY = "haircalc.settlementSettings.v1";
const TRANSACTIONS_KEY = "haircalc.transactions.v1";
const MONTHLY_ACTUAL_PAYOUTS_KEY = "haircalc.monthlyActualPayouts.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadSettlementSettings(): SettlementSettings {
  if (!isBrowser()) return createDefaultSettlementSettings();

  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) return createDefaultSettlementSettings();

  try {
    return { ...createDefaultSettlementSettings(), ...JSON.parse(raw) };
  } catch {
    return createDefaultSettlementSettings();
  }
}

export function saveSettlementSettings(settings: SettlementSettings): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadTransactions(): Transaction[] {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(TRANSACTIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Transaction[]) : [];
  } catch {
    return [];
  }
}

export function appendTransaction(transaction: Transaction): Transaction[] {
  const transactions = [...loadTransactions(), transaction];
  if (isBrowser()) {
    window.localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  }
  return transactions;
}

function loadMonthlyActualPayoutMap(): Record<string, MonthlyActualPayout> {
  if (!isBrowser()) return {};

  const raw = window.localStorage.getItem(MONTHLY_ACTUAL_PAYOUTS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadMonthlyActualPayout(month: string): MonthlyActualPayout | null {
  return loadMonthlyActualPayoutMap()[month] ?? null;
}

export function saveMonthlyActualPayout(month: string, amount: number): void {
  if (!isBrowser()) return;
  const map = loadMonthlyActualPayoutMap();
  map[month] = { month, amount, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(MONTHLY_ACTUAL_PAYOUTS_KEY, JSON.stringify(map));
}
