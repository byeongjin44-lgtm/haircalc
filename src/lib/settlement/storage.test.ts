// deletePrepaidPassFromStore 회귀 테스트. storage.ts의 나머지 함수는 브라우저 IndexedDB에
// 직접 의존해 Node에서 검증할 수 없지만, 삭제 로직은 RecordStore를 인자로 받아 순수하게
// 동작하므로 backup.ts/migration.ts와 같은 방식(createMemoryStore)으로 테스트한다.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deleteMembershipPassFromStore, deletePrepaidPassFromStore } from "./storage.ts";
import { createMemoryStore } from "./recordStore.memory.ts";
import type { MembershipEvent, MembershipPass, PrepaidEvent, PrepaidPass } from "./types.ts";

function makePrepaidPass(overrides: Partial<PrepaidPass> = {}): PrepaidPass {
  return {
    id: "pass-1",
    purchaseDate: "2026-09-01",
    paidAmount: 1_000_000,
    creditAmount: 1_000_000,
    remainingBalance: 800_000,
    recognitionMode: "SALE_IMMEDIATE",
    bonusSettlementMode: "CREDIT_AMOUNT",
    status: "ACTIVE",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePrepaidEvent(overrides: Partial<PrepaidEvent> = {}): PrepaidEvent {
  return {
    id: "evt-1",
    prepaidPassId: "pass-1",
    type: "PURCHASE",
    date: "2026-09-01",
    creditAmountImpact: 1_000_000,
    salesImpact: 1_000_000,
    settlementImpact: 400_000,
    commissionRateSnapshot: 0.4,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("E. deletePrepaidPassFromStore", () => {
  test("삭제 대상 pass와 연결된 이벤트만 제거하고 다른 pass/이벤트는 그대로 둔다", async () => {
    const store = createMemoryStore();

    await store.put("prepaidPasses", makePrepaidPass({ id: "pass-1" }));
    await store.put("prepaidPasses", makePrepaidPass({ id: "pass-2" }));
    await store.put("prepaidEvents", makePrepaidEvent({ id: "evt-1", prepaidPassId: "pass-1" }));
    await store.put(
      "prepaidEvents",
      makePrepaidEvent({ id: "evt-2", prepaidPassId: "pass-1", type: "USE" })
    );
    await store.put("prepaidEvents", makePrepaidEvent({ id: "evt-3", prepaidPassId: "pass-2" }));

    await deletePrepaidPassFromStore(store, "pass-1");

    const remainingPasses = await store.getAll<PrepaidPass>("prepaidPasses");
    const remainingEvents = await store.getAll<PrepaidEvent>("prepaidEvents");

    assert.deepEqual(
      remainingPasses.map((p) => p.id),
      ["pass-2"]
    );
    assert.deepEqual(
      remainingEvents.map((e) => e.id).sort(),
      ["evt-3"]
    );
  });

  test("이벤트가 없는 pass를 삭제해도 오류 없이 pass만 제거된다", async () => {
    const store = createMemoryStore();
    await store.put("prepaidPasses", makePrepaidPass({ id: "pass-only" }));

    await deletePrepaidPassFromStore(store, "pass-only");

    assert.deepEqual(await store.getAll<PrepaidPass>("prepaidPasses"), []);
  });
});

function makeMembershipPass(overrides: Partial<MembershipPass> = {}): MembershipPass {
  return {
    id: "membership-1",
    label: "김OO 클리닉 10회권",
    purchaseDate: "2026-09-01",
    paidAmount: 500_000,
    totalCount: 10,
    remainingCount: 9,
    recognitionMode: "USE_BASED",
    status: "ACTIVE",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMembershipEvent(overrides: Partial<MembershipEvent> = {}): MembershipEvent {
  return {
    id: "m-evt-1",
    membershipPassId: "membership-1",
    type: "PURCHASE",
    date: "2026-09-01",
    countImpact: 10,
    salesImpact: 0,
    settlementImpact: 0,
    commissionRateSnapshot: 0.4,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("H. deleteMembershipPassFromStore", () => {
  test("삭제 대상 pass와 연결된 이벤트만 제거하고 다른 pass/이벤트는 그대로 둔다", async () => {
    const store = createMemoryStore();

    await store.put("membershipPasses", makeMembershipPass({ id: "membership-1" }));
    await store.put("membershipPasses", makeMembershipPass({ id: "membership-2" }));
    await store.put(
      "membershipEvents",
      makeMembershipEvent({ id: "m-evt-1", membershipPassId: "membership-1" })
    );
    await store.put(
      "membershipEvents",
      makeMembershipEvent({ id: "m-evt-2", membershipPassId: "membership-1", type: "USE" })
    );
    await store.put(
      "membershipEvents",
      makeMembershipEvent({ id: "m-evt-3", membershipPassId: "membership-2" })
    );

    await deleteMembershipPassFromStore(store, "membership-1");

    const remainingPasses = await store.getAll<MembershipPass>("membershipPasses");
    const remainingEvents = await store.getAll<MembershipEvent>("membershipEvents");

    assert.deepEqual(
      remainingPasses.map((p) => p.id),
      ["membership-2"]
    );
    assert.deepEqual(
      remainingEvents.map((e) => e.id).sort(),
      ["m-evt-3"]
    );
  });

  test("이벤트가 없는 pass를 삭제해도 오류 없이 pass만 제거된다", async () => {
    const store = createMemoryStore();
    await store.put("membershipPasses", makeMembershipPass({ id: "membership-only" }));

    await deleteMembershipPassFromStore(store, "membership-only");

    assert.deepEqual(await store.getAll<MembershipPass>("membershipPasses"), []);
  });
});
