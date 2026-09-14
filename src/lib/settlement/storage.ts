// 저장 계층 (공개 API). UI는 이 파일만 알면 되고, IndexedDB 구현(recordStore.indexeddb.ts)이나
// 마이그레이션/백업 세부 구현(migration.ts, backup.ts)을 직접 알 필요가 없다.
//
// 이전에는 localStorage를 동기로 읽고 썼지만, 이제는 IndexedDB 기반이라 전부 비동기다.
// 최초 호출 시 legacy localStorage(v1) 데이터를 IndexedDB로 자동 이전한다 (ensureMigrated).

import { createDefaultSettlementSettings } from "./engine.ts";
import { buildBackup, restoreBackup, type BackupData } from "./backup.ts";
import { clearLegacyLocalStorage, ensureMigrated } from "./migration.ts";
import { indexedDbStore } from "./recordStore.indexeddb.ts";
import { STORE_NAMES, type RecordStore } from "./recordStore.ts";
import type { PrepaidLedgerResult } from "./prepaid.ts";
import type {
  MonthlyActualPayout,
  PrepaidEvent,
  PrepaidPass,
  SettlementSettings,
  Transaction,
} from "./types.ts";

export type { BackupData } from "./backup.ts";
export { validateBackup } from "./backup.ts";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** 첫 호출에서 legacy localStorage -> IndexedDB 마이그레이션을 보장한 뒤 store를 돌려준다. */
async function ready() {
  await ensureMigrated(indexedDbStore);
  return indexedDbStore;
}

export async function loadSettlementSettings(): Promise<SettlementSettings> {
  if (!isBrowser()) return createDefaultSettlementSettings();
  const store = await ready();
  const record = await store.get<SettlementSettings>("settings", "default");
  return record ?? createDefaultSettlementSettings();
}

export async function saveSettlementSettings(settings: SettlementSettings): Promise<void> {
  if (!isBrowser()) return;
  const store = await ready();
  await store.put("settings", settings);
}

export async function loadTransactions(): Promise<Transaction[]> {
  if (!isBrowser()) return [];
  const store = await ready();
  return store.getAll<Transaction>("transactions");
}

export async function appendTransaction(transaction: Transaction): Promise<void> {
  if (!isBrowser()) return;
  const store = await ready();
  await store.put("transactions", transaction);
}

export async function loadMonthlyActualPayout(
  month: string
): Promise<MonthlyActualPayout | null> {
  if (!isBrowser()) return null;
  const store = await ready();
  const record = await store.get<MonthlyActualPayout>("monthlyActualPayouts", month);
  return record ?? null;
}

export async function loadAllMonthlyActualPayouts(): Promise<MonthlyActualPayout[]> {
  if (!isBrowser()) return [];
  const store = await ready();
  return store.getAll<MonthlyActualPayout>("monthlyActualPayouts");
}

export async function saveMonthlyActualPayout(month: string, amount: number): Promise<void> {
  if (!isBrowser()) return;
  const store = await ready();
  await store.put<MonthlyActualPayout>("monthlyActualPayouts", {
    month,
    amount,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadPrepaidPasses(): Promise<PrepaidPass[]> {
  if (!isBrowser()) return [];
  const store = await ready();
  return store.getAll<PrepaidPass>("prepaidPasses");
}

export async function upsertPrepaidPass(pass: PrepaidPass): Promise<void> {
  if (!isBrowser()) return;
  const store = await ready();
  await store.put("prepaidPasses", pass);
}

export async function loadPrepaidEvents(): Promise<PrepaidEvent[]> {
  if (!isBrowser()) return [];
  const store = await ready();
  return store.getAll<PrepaidEvent>("prepaidEvents");
}

export async function appendPrepaidEvent(event: PrepaidEvent): Promise<void> {
  if (!isBrowser()) return;
  const store = await ready();
  await store.put("prepaidEvents", event);
}

/** prepaid.ts의 각 함수가 반환하는 {pass, event}를 그대로 저장한다 (과거 이벤트는 절대 덮어쓰지 않음). */
export async function recordPrepaidLedgerResult(result: PrepaidLedgerResult): Promise<void> {
  await upsertPrepaidPass(result.pass);
  await appendPrepaidEvent(result.event);
}

/**
 * 정액권 삭제 로직 (store를 인자로 받아 Node 테스트에서도 검증 가능). pass와 그에 연결된
 * 모든 PrepaidEvent를 함께 지운다 — 둘 중 하나만 남으면 원장이 깨지므로 항상 같이 지운다.
 */
export async function deletePrepaidPassFromStore(
  store: RecordStore,
  passId: string
): Promise<void> {
  const events = await store.getAll<PrepaidEvent>("prepaidEvents");
  for (const event of events) {
    if (event.prepaidPassId === passId) {
      await store.delete("prepaidEvents", event.id);
    }
  }
  await store.delete("prepaidPasses", passId);
}

export async function deletePrepaidPass(passId: string): Promise<void> {
  if (!isBrowser()) return;
  const store = await ready();
  await deletePrepaidPassFromStore(store, passId);
}

/** 전체 데이터를 하나의 JSON 백업 객체로 만든다 (/settings의 "백업 파일 내보내기"). */
export async function exportBackup(): Promise<BackupData> {
  const store = await ready();
  return buildBackup(store);
}

/**
 * 검증된 백업 데이터로 전체 교체 복원한다 (병합 없음). 호출 전 반드시 validateBackup으로
 * 확인해야 한다 — 이 함수는 형식이 맞다고 가정하고 바로 덮어쓴다.
 */
export async function importBackup(data: BackupData): Promise<void> {
  const store = await ready();
  await restoreBackup(store, data);
}

/** IndexedDB 전체 + 마이그레이션 상태 + legacy localStorage까지 전부 지운다. 되돌릴 수 없다. */
export async function wipeAllData(): Promise<void> {
  if (!isBrowser()) return;
  for (const name of STORE_NAMES) {
    await indexedDbStore.clear(name);
  }
  clearLegacyLocalStorage();
}
