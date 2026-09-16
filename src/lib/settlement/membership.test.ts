import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDefaultSettlementSettings } from "./engine.ts";
import {
  adjustMembershipPass,
  calculatePerUseAmount,
  calculateRemainingCountFromEvents,
  closeMembershipPass,
  purchaseMembershipPass,
  useByOtherDesigner,
  useOwnMembershipCount,
  type CreateMembershipPassInput,
} from "./membership.ts";

const NOW = "2026-09-15T00:00:00.000Z";

function purchaseInput(
  overrides: Partial<CreateMembershipPassInput> = {}
): CreateMembershipPassInput {
  return {
    id: "membership-1",
    label: "김OO 클리닉 10회권",
    purchaseDate: "2026-09-15",
    paidAmount: 500_000,
    totalCount: 10,
    recognitionMode: "USE_BASED",
    createdAt: NOW,
    ...overrides,
  };
}

describe("A. calculatePerUseAmount", () => {
  test("50만원 / 10회 -> 1회 기준 5만원", () => {
    assert.equal(calculatePerUseAmount(500_000, 10), 50_000);
  });

  test("나누어떨어지지 않으면 원 단위로 반올림된다", () => {
    assert.equal(calculatePerUseAmount(100_000, 3), Math.round(100_000 / 3));
  });

  test("totalCount가 0이면 방어적으로 0을 반환한다", () => {
    assert.equal(calculatePerUseAmount(500_000, 0), 0);
  });
});

describe("B. 사용시반영형(USE_BASED) 구매/사용", () => {
  test("구매 시점에는 매출/정산 영향이 없다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass, event } = purchaseMembershipPass(purchaseInput(), settings);

    assert.equal(pass.remainingCount, 10);
    assert.equal(pass.status, "ACTIVE");
    assert.equal(event.type, "PURCHASE");
    assert.equal(event.countImpact, 10);
    assert.equal(event.salesImpact, 0);
    assert.equal(event.settlementImpact, 0);
  });

  test("1회 사용 시 (실결제금액/전체횟수)만큼 매출/정산에 반영된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput(), settings);

    const result = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingCount, 9);
    assert.equal(result.event.countImpact, -1);
    assert.equal(result.event.salesImpact, 50_000);
    assert.equal(result.event.settlementImpact, 20_000); // 50,000 * 0.4
    assert.equal(result.event.perUseAmountSnapshot, 50_000);
  });
});

describe("C. 판매즉시반영형(SALE_IMMEDIATE) 구매/사용", () => {
  test("구매 즉시 전체 결제금액이 매출/정산에 반영된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { event } = purchaseMembershipPass(
      purchaseInput({ recognitionMode: "SALE_IMMEDIATE" }),
      settings
    );

    assert.equal(event.salesImpact, 500_000);
    assert.equal(event.settlementImpact, 200_000);
  });

  test("본인 사용 시에는 이미 반영된 매출이라 중복 정산이 없다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(
      purchaseInput({ recognitionMode: "SALE_IMMEDIATE" }),
      settings
    );

    const result = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingCount, 9);
    assert.equal(result.event.salesImpact, 0);
    assert.equal(result.event.settlementImpact, 0);
  });
});

describe("D. 남은 횟수 차감", () => {
  test("10회 -> 1회 사용 -> 9회", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput(), settings);

    const result = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingCount, 9);
    assert.equal(result.pass.status, "ACTIVE");
  });

  test("마지막 1회를 사용하면 소진(DEPLETED) 상태가 된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput({ totalCount: 1 }), settings);

    const result = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingCount, 0);
    assert.equal(result.pass.status, "DEPLETED");
  });
});

describe("E. 잘못된 초과 사용 방지", () => {
  test("0회에서 추가 사용을 시도하면 오류를 던진다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput({ totalCount: 1 }), settings);
    const depleted = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    ).pass;

    assert.throws(() =>
      useOwnMembershipCount(
        depleted,
        { id: "evt-3", date: "2026-09-17", count: 1, createdAt: NOW },
        settings
      )
    );
  });

  test("종료(CLOSED)된 회원권은 사용할 수 없다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput(), settings);
    const closed = closeMembershipPass(pass);

    assert.throws(() =>
      useOwnMembershipCount(
        closed,
        { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
        settings
      )
    );
  });
});

describe("F. 타 디자이너 사용", () => {
  test("USE_BASED는 애초에 반영된 매출이 없어 영향이 없다 (횟수만 감소)", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput(), settings);

    const result = useByOtherDesigner(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingCount, 9);
    assert.equal(result.event.type, "OTHER_DESIGNER_USE");
    assert.equal(result.event.salesImpact, 0);
    assert.equal(result.event.settlementImpact, 0);
  });

  test("SALE_IMMEDIATE는 구매 시 잡힌 매출을 환수한다 (정액권 정책과 동일)", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(
      purchaseInput({ recognitionMode: "SALE_IMMEDIATE" }),
      settings
    );

    const result = useByOtherDesigner(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingCount, 9);
    assert.equal(result.event.salesImpact, -50_000);
    assert.equal(result.event.settlementImpact, -20_000);
  });
});

describe("G. 횟수 조정 (+1/-1)", () => {
  test("+1 조정으로 남은 횟수가 늘어난다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput({ totalCount: 10 }), settings);
    const used = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    ).pass;

    const result = adjustMembershipPass(used, {
      id: "evt-3",
      date: "2026-09-17",
      countImpact: 1,
      salesImpact: 0,
      settlementImpact: 0,
      createdAt: NOW,
    });

    assert.equal(result.pass.remainingCount, 10); // 10 -> 9(사용) -> 10(조정으로 +1)
  });

  test("-1 조정으로 남은 횟수가 줄어든다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput({ totalCount: 10 }), settings);

    const result = adjustMembershipPass(pass, {
      id: "evt-2",
      date: "2026-09-16",
      countImpact: -1,
      salesImpact: 0,
      settlementImpact: 0,
      createdAt: NOW,
    });

    assert.equal(result.pass.remainingCount, 9);
  });

  test("남은 횟수가 음수가 되는 조정은 차단한다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput({ totalCount: 1 }), settings);
    const depleted = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 1, createdAt: NOW },
      settings
    ).pass;

    assert.throws(() =>
      adjustMembershipPass(depleted, {
        id: "evt-3",
        date: "2026-09-17",
        countImpact: -1,
        salesImpact: 0,
        settlementImpact: 0,
        createdAt: NOW,
      })
    );
  });

  test("전체횟수를 초과하는 조정은 차단한다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchaseMembershipPass(purchaseInput({ totalCount: 10 }), settings);

    assert.throws(() =>
      adjustMembershipPass(pass, {
        id: "evt-2",
        date: "2026-09-16",
        countImpact: 1,
        salesImpact: 0,
        settlementImpact: 0,
        createdAt: NOW,
      })
    );
  });
});

describe("calculateRemainingCountFromEvents", () => {
  test("이벤트 이력만으로 남은 횟수를 재계산할 수 있다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass, event: purchaseEvent } = purchaseMembershipPass(
      purchaseInput({ totalCount: 10 }),
      settings
    );
    const { event: useEvent } = useOwnMembershipCount(
      pass,
      { id: "evt-2", date: "2026-09-16", count: 3, createdAt: NOW },
      settings
    );

    const remaining = calculateRemainingCountFromEvents(pass.id, [purchaseEvent, useEvent]);
    assert.equal(remaining, 7);
  });
});
