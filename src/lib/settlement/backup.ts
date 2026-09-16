// 전체 데이터 JSON 백업/복원. 병합 복원은 지원하지 않는다 (전체 교체만).

import { createDefaultSettlementSettings } from "./engine.ts";
import { DATA_STORE_NAMES, type RecordStore } from "./recordStore.ts";
import { setMigrationFlag } from "./migration.ts";
import type {
  MembershipEvent,
  MembershipPass,
  MonthlyActualPayout,
  PrepaidEvent,
  PrepaidPass,
  SettlementSettings,
  Transaction,
} from "./types.ts";

export const BACKUP_VERSION = 1;
// v2: membershipPasses/membershipEvents 필드 추가 (회원권 기능). 두 필드는 optional이라
// schemaVersion 1(회원권 이전) 백업도 그대로 읽힌다 — validateBackup/restoreBackup 참고.
export const SCHEMA_VERSION = 2;

export interface BackupData {
  backupVersion: number;
  schemaVersion: number;
  exportedAt: string;
  settings: SettlementSettings;
  transactions: Transaction[];
  prepaidPasses: PrepaidPass[];
  prepaidEvents: PrepaidEvent[];
  monthlyActualPayouts: MonthlyActualPayout[];
  /** schemaVersion 1(회원권 이전) 백업에는 이 필드가 없다 — 없으면 빈 배열로 취급한다. */
  membershipPasses?: MembershipPass[];
  membershipEvents?: MembershipEvent[];
}

export async function buildBackup(store: RecordStore): Promise<BackupData> {
  const [
    settings,
    transactions,
    prepaidPasses,
    prepaidEvents,
    monthlyActualPayouts,
    membershipPasses,
    membershipEvents,
  ] = await Promise.all([
    store.get<SettlementSettings>("settings", "default"),
    store.getAll<Transaction>("transactions"),
    store.getAll<PrepaidPass>("prepaidPasses"),
    store.getAll<PrepaidEvent>("prepaidEvents"),
    store.getAll<MonthlyActualPayout>("monthlyActualPayouts"),
    store.getAll<MembershipPass>("membershipPasses"),
    store.getAll<MembershipEvent>("membershipEvents"),
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
    membershipPasses,
    membershipEvents,
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
  // 회원권 필드는 schemaVersion 1(회원권 이전) 백업에는 아예 없을 수 있다 — 없으면 통과,
  // 있으면 반드시 배열이어야 한다 (손상된 값은 차단).
  if (data.membershipPasses !== undefined && !Array.isArray(data.membershipPasses)) return false;
  if (data.membershipEvents !== undefined && !Array.isArray(data.membershipEvents)) return false;

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
  // 구버전(schemaVersion 1) 백업에는 이 필드가 없다 — 없으면 빈 배열로 정상 복원된다.
  for (const pass of data.membershipPasses ?? []) {
    await store.put("membershipPasses", pass);
  }
  for (const event of data.membershipEvents ?? []) {
    await store.put("membershipEvents", event);
  }

  // 복원된 데이터는 legacy localStorage 마이그레이션 대상이 아니므로 완료 상태로 표시한다.
  await setMigrationFlag(store);
}
