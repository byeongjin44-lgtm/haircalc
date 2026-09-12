// 전체 데이터 JSON 백업/복원. 병합 복원은 지원하지 않는다 (전체 교체만).

import { createDefaultSettlementSettings } from "./engine.ts";
import { DATA_STORE_NAMES, type RecordStore } from "./recordStore.ts";
import { setMigrationFlag } from "./migration.ts";
import type {
  MonthlyActualPayout,
  PrepaidEvent,
  PrepaidPass,
  SettlementSettings,
  Transaction,
} from "./types.ts";

export const BACKUP_VERSION = 1;
export const SCHEMA_VERSION = 1;

export interface BackupData {
  backupVersion: number;
  schemaVersion: number;
  exportedAt: string;
  settings: SettlementSettings;
  transactions: Transaction[];
  prepaidPasses: PrepaidPass[];
  prepaidEvents: PrepaidEvent[];
  monthlyActualPayouts: MonthlyActualPayout[];
}

export async function buildBackup(store: RecordStore): Promise<BackupData> {
  const [settings, transactions, prepaidPasses, prepaidEvents, monthlyActualPayouts] =
    await Promise.all([
      store.get<SettlementSettings>("settings", "default"),
      store.getAll<Transaction>("transactions"),
      store.getAll<PrepaidPass>("prepaidPasses"),
      store.getAll<PrepaidEvent>("prepaidEvents"),
      store.getAll<MonthlyActualPayout>("monthlyActualPayouts"),
    ]);

  return {
    backupVersion: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: settings ?? createDefaultSettlementSettings(),
    transactions,
    prepaidPasses,
    prepaidEvents,
    monthlyActualPayouts,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 백업 JSON의 구조/버전을 검증한다. 여기를 통과하지 못하면 복원을 절대 진행하지 않는다.
 * 지금보다 높은 backupVersion/schemaVersion(미래 포맷)은 지원하지 않는 것으로 처리한다.
 */
export function validateBackup(data: unknown): data is BackupData {
  if (!isPlainObject(data)) return false;

  if (typeof data.backupVersion !== "number" || data.backupVersion > BACKUP_VERSION) {
    return false;
  }
  if (typeof data.schemaVersion !== "number" || data.schemaVersion > SCHEMA_VERSION) {
    return false;
  }
  if (typeof data.exportedAt !== "string") return false;
  if (!isPlainObject(data.settings)) return false;
  if (!Array.isArray(data.transactions)) return false;
  if (!Array.isArray(data.prepaidPasses)) return false;
  if (!Array.isArray(data.prepaidEvents)) return false;
  if (!Array.isArray(data.monthlyActualPayouts)) return false;

  return true;
}

/** 전체 교체 복원. 기존 데이터를 전부 지우고 백업 내용으로 바꾼다 (병합 없음). */
export async function restoreBackup(store: RecordStore, data: BackupData): Promise<void> {
  for (const name of DATA_STORE_NAMES) {
    await store.clear(name);
  }

  await store.put("settings", data.settings);
  for (const tx of data.transactions) {
    await store.put("transactions", tx);
  }
  for (const pass of data.prepaidPasses) {
    await store.put("prepaidPasses", pass);
  }
  for (const event of data.prepaidEvents) {
    await store.put("prepaidEvents", event);
  }
  for (const payout of data.monthlyActualPayouts) {
    await store.put("monthlyActualPayouts", payout);
  }

  // 복원된 데이터는 legacy localStorage 마이그레이션 대상이 아니므로 완료 상태로 표시한다.
  await setMigrationFlag(store);
}
