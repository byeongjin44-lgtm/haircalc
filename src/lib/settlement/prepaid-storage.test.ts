// 정액권 저장소(localStorage) 왕복 테스트. Node에는 window가 없으므로 최소한의 in-memory
// localStorage로 대체해, 실제 UI가 호출하는 storage.ts 함수를 그대로 검증한다.
// 시나리오 E: "새로고침 후 정액권/이벤트/잔액/월합계가 모두 동일하다."

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

const memoryStore: Record<string, string> = {};

(globalThis as unknown as { window: Window }).window = {
  localStorage: {
    getItem: (key: string) =>
      Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = value;
    },
  },
} as unknown as Window;

const { loadPrepaidPasses, upsertPrepaidPass, loadPrepaidEvents, appendPrepaidEvent } =
  await import("./storage.ts");
const { calculateBalanceFromEvents, purchasePrepaidPass, useOwnPrepaidCredit } = await import(
  "./prepaid.ts"
);
const { createDefaultSettlementSettings } = await import("./engine.ts");
const { combinePeriodSummary, filterPrepaidEventsByMonth } = await import("./summary.ts");

beforeEach(() => {
  for (const key of Object.keys(memoryStore)) delete memoryStore[key];
});

describe("E. 정액권 저장소 새로고침 유지", () => {
  test("판매 + 본인 사용 후 다시 읽어도 잔액/이벤트/월합계가 동일하다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const now = "2026-09-01T00:00:00.000Z";

    const purchase = purchasePrepaidPass(
      {
        id: "pass-e",
        purchaseDate: "2026-09-05",
        paidAmount: 1_000_000,
        creditAmount: 1_000_000,
        recognitionMode: "SALE_IMMEDIATE",
        bonusSettlementMode: "CREDIT_AMOUNT",
        createdAt: now,
      },
      settings
    );
    upsertPrepaidPass(purchase.pass);
    appendPrepaidEvent(purchase.event);

    const use = useOwnPrepaidCredit(
      purchase.pass,
      { id: "evt-e", date: "2026-09-10", creditAmount: 200_000, createdAt: now },
      settings
    );
    upsertPrepaidPass(use.pass);
    appendPrepaidEvent(use.event);

    // "새로고침" = localStorage에서 처음부터 다시 읽는 것과 동일하다.
    const reloadedPasses = loadPrepaidPasses();
    const reloadedEvents = loadPrepaidEvents();

    assert.equal(reloadedPasses.length, 1);
    assert.equal(reloadedPasses[0].remainingBalance, 800_000);
    assert.equal(reloadedEvents.length, 2);
    assert.equal(
      calculateBalanceFromEvents(reloadedPasses[0].id, reloadedEvents),
      reloadedPasses[0].remainingBalance
    );

    const summary = combinePeriodSummary(
      [],
      filterPrepaidEventsByMonth(reloadedEvents, "2026-09")
    );
    // SALE_IMMEDIATE 본인 사용은 추가 매출/정산 영향이 없으므로 구매분(40만)만 반영된다.
    assert.equal(summary.totalAmount, 1_000_000);
    assert.equal(summary.totalSettlementAmount, 400_000);
  });
});
