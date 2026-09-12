// 로컬 저장 (localStorage) 전용. 서버/외부 DB 없이 브라우저에만 데이터를 유지한다.

import { createDefaultSettlementSettings } from "./engine.ts";
import type {
  MonthlyActualPayout,
  PrepaidEvent,
  PrepaidPass,
  SettlementSettings,
  Transaction,
} from "./types.ts";
import type { PrepaidLedgerResult } from "./prepaid.ts";

const SETTINGS_KEY = "haircalc.settlementSettings.v1";
const TRANSACTIONS_KEY = "haircalc.transactions.v1";
const MONTHLY_ACTUAL_PAYOUTS_KEY = "haircalc.monthlyActualPayouts.v1";
const PREPAID_PASSES_KEY = "haircalc.prepaidPasses.v1";
const PREPAID_EVENTS_KEY = "haircalc.prepaidEvents.v1";

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

export function loadPrepaidPasses(): PrepaidPass[] {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(PREPAID_PASSES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrepaidPass[]) : [];
  } catch {
    return [];
  }
}

/** id가 같은 정액권이 있으면 갱신하고, 없으면 새로 추가한다 (사용/환불로 잔액이 바뀔 때마다 호출). */
export function upsertPrepaidPass(pass: PrepaidPass): PrepaidPass[] {
  const passes = loadPrepaidPasses();
  const index = passes.findIndex((p) => p.id === pass.id);
  const next =
    index >= 0
      ? passes.map((p, i) => (i === index ? pass : p))
      : [...passes, pass];

  if (isBrowser()) {
    window.localStorage.setItem(PREPAID_PASSES_KEY, JSON.stringify(next));
  }
  return next;
}

export function loadPrepaidEvents(): PrepaidEvent[] {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(PREPAID_EVENTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrepaidEvent[]) : [];
  } catch {
    return [];
  }
}

export function appendPrepaidEvent(event: PrepaidEvent): PrepaidEvent[] {
  const events = [...loadPrepaidEvents(), event];
  if (isBrowser()) {
    window.localStorage.setItem(PREPAID_EVENTS_KEY, JSON.stringify(events));
  }
  return events;
}

/** prepaid.ts의 각 함수가 반환하는 {pass, event}를 그대로 저장한다 (과거 이벤트는 절대 덮어쓰지 않음). */
export function recordPrepaidLedgerResult(result: PrepaidLedgerResult): void {
  upsertPrepaidPass(result.pass);
  appendPrepaidEvent(result.event);
}
