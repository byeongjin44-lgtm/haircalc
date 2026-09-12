import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDefaultSettlementSettings } from "./engine.ts";
import {
  adjustPrepaidPass,
  calculateBalanceFromEvents,
  closePrepaidPass,
  convertCreditToSalesAmount,
  purchasePrepaidPass,
  refundPrepaidCredit,
  useByOtherDesigner,
  useOwnPrepaidCredit,
  type CreatePrepaidPassInput,
} from "./prepaid.ts";

const NOW = "2026-09-12T00:00:00.000Z";

function purchaseInput(
  overrides: Partial<CreatePrepaidPassInput> = {}
): CreatePrepaidPassInput {
  return {
    id: "pass-1",
    purchaseDate: "2026-09-12",
    paidAmount: 1_000_000,
    creditAmount: 1_000_000,
    recognitionMode: "SALE_IMMEDIATE",
    bonusSettlementMode: "CREDIT_AMOUNT",
    createdAt: NOW,
    ...overrides,
  };
}

describe("1. 판매즉시형 일반 정액권 구매", () => {
  test("구매 즉시 매출/정산에 반영된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass, event } = purchasePrepaidPass(purchaseInput(), settings);

    assert.equal(pass.remainingBalance, 1_000_000);
    assert.equal(pass.status, "ACTIVE");
    assert.equal(event.type, "PURCHASE");
    assert.equal(event.creditAmountImpact, 1_000_000);
    assert.equal(event.salesImpact, 1_000_000);
    assert.equal(event.settlementImpact, 400_000);
    assert.equal(event.commissionRateSnapshot, 0.4);
  });
});

describe("2. 판매즉시형 본인 사용", () => {
  test("이미 인식된 매출이라 추가 영향이 없다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(purchaseInput(), settings);

    const result = useOwnPrepaidCredit(
      pass,
      { id: "evt-2", date: "2026-09-13", creditAmount: 200_000, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingBalance, 800_000);
    assert.equal(result.event.creditAmountImpact, -200_000);
    assert.equal(result.event.salesImpact, 0);
    assert.equal(result.event.settlementImpact, 0);
  });
});

describe("3. 판매즉시형 타디자이너 사용 환수", () => {
  test("현재 디자이너 매출/정산에서 환수된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(purchaseInput(), settings);

    const result = useByOtherDesigner(
      pass,
      { id: "evt-3", date: "2026-09-13", creditAmount: 200_000, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingBalance, 800_000);
    assert.equal(result.event.creditAmountImpact, -200_000);
    assert.equal(result.event.salesImpact, -200_000);
    assert.equal(result.event.settlementImpact, -80_000);
  });
});

describe("4. 판매즉시형 부분 환불", () => {
  test("환불분만큼 매출/정산이 환수된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(purchaseInput(), settings);

    const result = refundPrepaidCredit(
      pass,
      { id: "evt-4", date: "2026-09-14", creditAmount: 300_000, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingBalance, 700_000);
    assert.equal(result.event.creditAmountImpact, -300_000);
    assert.equal(result.event.salesImpact, -300_000);
    assert.equal(result.event.settlementImpact, -120_000);
  });
});

describe("5. 사용시형 구매", () => {
  test("구매 시점에는 매출/정산 영향이 없다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass, event } = purchasePrepaidPass(
      purchaseInput({ recognitionMode: "USE_BASED" }),
      settings
    );

    assert.equal(pass.remainingBalance, 1_000_000);
    assert.equal(event.creditAmountImpact, 1_000_000);
    assert.equal(event.salesImpact, 0);
    assert.equal(event.settlementImpact, 0);
  });
});

describe("6. 사용시형 본인 사용", () => {
  test("사용 시점에 매출/정산이 인식된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ recognitionMode: "USE_BASED" }),
      settings
    );

    const result = useOwnPrepaidCredit(
      pass,
      { id: "evt-6", date: "2026-09-13", creditAmount: 200_000, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingBalance, 800_000);
    assert.equal(result.event.salesImpact, 200_000);
    assert.equal(result.event.settlementImpact, 80_000);
  });
});

describe("7. 사용시형 타디자이너 사용", () => {
  test("애초에 반영된 적이 없어 영향이 없다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ recognitionMode: "USE_BASED" }),
      settings
    );

    const result = useByOtherDesigner(
      pass,
      { id: "evt-7", date: "2026-09-13", creditAmount: 200_000, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingBalance, 800_000);
    assert.equal(result.event.salesImpact, 0);
    assert.equal(result.event.settlementImpact, 0);
  });
});

describe("8. 사용시형 미사용 잔액 환불", () => {
  test("매출로 잡힌 적이 없어 영향이 없다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ recognitionMode: "USE_BASED" }),
      settings
    );

    const result = refundPrepaidCredit(
      pass,
      { id: "evt-8", date: "2026-09-14", creditAmount: 300_000, createdAt: NOW },
      settings
    );

    assert.equal(result.pass.remainingBalance, 700_000);
    assert.equal(result.event.salesImpact, 0);
    assert.equal(result.event.settlementImpact, 0);
  });
});

describe("9. 보너스 정액권 구매 (100만원 결제 -> 110만원 사용가능)", () => {
  test("잔액은 사용가능액 기준, 매출은 실결제금액 기준으로 잡힌다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass, event } = purchasePrepaidPass(
      purchaseInput({
        paidAmount: 1_000_000,
        creditAmount: 1_100_000,
        bonusSettlementMode: "PAID_RATIO",
      }),
      settings
    );

    assert.equal(pass.creditAmount, 1_100_000);
    assert.equal(pass.remainingBalance, 1_100_000);
    assert.equal(event.creditAmountImpact, 1_100_000);
    // 보너스로 늘어난 금액은 실제 매출이 아니므로 paidAmount 기준으로만 인식한다.
    assert.equal(event.salesImpact, 1_000_000);
    assert.equal(event.settlementImpact, 400_000);
  });
});

describe("10. 보너스권 PAID_RATIO 환산", () => {
  test("MASTER 예시: 220,000 사용 -> 실결제 비율 환산 시 200,000 매출", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({
        recognitionMode: "USE_BASED",
        paidAmount: 1_000_000,
        creditAmount: 1_100_000,
        bonusSettlementMode: "PAID_RATIO",
      }),
      settings
    );

    assert.equal(convertCreditToSalesAmount(pass, 220_000), 200_000);

    const result = useOwnPrepaidCredit(
      pass,
      { id: "evt-10", date: "2026-09-13", creditAmount: 220_000, createdAt: NOW },
      settings
    );

    assert.equal(result.event.salesImpact, 200_000);
    assert.equal(result.event.settlementImpact, 80_000); // 200,000 * 0.4
    assert.equal(result.pass.remainingBalance, 880_000); // 1,100,000 - 220,000
  });

  test("CREDIT_AMOUNT 모드는 환산 없이 차감액을 그대로 매출로 인정한다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({
        recognitionMode: "USE_BASED",
        paidAmount: 1_000_000,
        creditAmount: 1_100_000,
        bonusSettlementMode: "CREDIT_AMOUNT",
      }),
      settings
    );

    assert.equal(convertCreditToSalesAmount(pass, 220_000), 220_000);
  });
});

describe("11. 부분사용 여러 번", () => {
  test("연속된 사용/환수/환불이 잔액에 순서대로 반영된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    let { pass } = purchasePrepaidPass(purchaseInput(), settings); // 1,000,000

    ({ pass } = useOwnPrepaidCredit(
      pass,
      { id: "evt-11a", date: "2026-09-13", creditAmount: 300_000, createdAt: NOW },
      settings
    ));
    assert.equal(pass.remainingBalance, 700_000);

    ({ pass } = useByOtherDesigner(
      pass,
      { id: "evt-11b", date: "2026-09-14", creditAmount: 200_000, createdAt: NOW },
      settings
    ));
    assert.equal(pass.remainingBalance, 500_000);

    ({ pass } = refundPrepaidCredit(
      pass,
      { id: "evt-11c", date: "2026-09-15", creditAmount: 100_000, createdAt: NOW },
      settings
    ));
    assert.equal(pass.remainingBalance, 400_000);
  });
});

describe("12. 잔액 정확성 (이벤트 이력으로 재계산)", () => {
  test("이벤트 creditAmountImpact 합이 최종 remainingBalance와 일치한다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const events = [];

    const purchase = purchasePrepaidPass(purchaseInput(), settings);
    events.push(purchase.event);
    let pass = purchase.pass;

    const useResult = useOwnPrepaidCredit(
      pass,
      { id: "evt-12a", date: "2026-09-13", creditAmount: 300_000, createdAt: NOW },
      settings
    );
    events.push(useResult.event);
    pass = useResult.pass;

    const otherUseResult = useByOtherDesigner(
      pass,
      { id: "evt-12b", date: "2026-09-14", creditAmount: 200_000, createdAt: NOW },
      settings
    );
    events.push(otherUseResult.event);
    pass = otherUseResult.pass;

    const refundResult = refundPrepaidCredit(
      pass,
      { id: "evt-12c", date: "2026-09-15", creditAmount: 100_000, createdAt: NOW },
      settings
    );
    events.push(refundResult.event);
    pass = refundResult.pass;

    assert.equal(pass.remainingBalance, 400_000);
    assert.equal(calculateBalanceFromEvents(pass.id, events), pass.remainingBalance);
  });
});

describe("13. 잔액 초과 사용 차단", () => {
  test("본인 사용이 잔액을 초과하면 예외를 던진다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ paidAmount: 100_000, creditAmount: 100_000 }),
      settings
    );

    assert.throws(() =>
      useOwnPrepaidCredit(
        pass,
        { id: "evt-13", date: "2026-09-13", creditAmount: 200_000, createdAt: NOW },
        settings
      )
    );
  });

  test("타디자이너 사용이 잔액을 초과하면 예외를 던진다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ paidAmount: 100_000, creditAmount: 100_000 }),
      settings
    );

    assert.throws(() =>
      useByOtherDesigner(
        pass,
        { id: "evt-13b", date: "2026-09-13", creditAmount: 200_000, createdAt: NOW },
        settings
      )
    );
  });
});

describe("14. 잔액 초과 환불 차단", () => {
  test("환불액이 잔액을 초과하면 예외를 던진다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ paidAmount: 100_000, creditAmount: 100_000 }),
      settings
    );

    assert.throws(() =>
      refundPrepaidCredit(
        pass,
        { id: "evt-14", date: "2026-09-13", creditAmount: 200_000, createdAt: NOW },
        settings
      )
    );
  });
});

describe("15. 설정 변경 후 기존 이벤트 영향값 불변", () => {
  test("이후 baseIncentiveRate를 바꿔도 이미 만든 이벤트 값은 그대로다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { event } = purchasePrepaidPass(purchaseInput(), settings);

    assert.equal(event.settlementImpact, 400_000);
    assert.equal(event.commissionRateSnapshot, 0.4);

    settings.baseIncentiveRate = 0.9;

    assert.equal(event.settlementImpact, 400_000);
    assert.equal(event.commissionRateSnapshot, 0.4);
  });
});

describe("잔액 무결성 - 추가 가드", () => {
  test("잔액이 0이 되면 DEPLETED 상태가 된다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ paidAmount: 100_000, creditAmount: 100_000 }),
      settings
    );

    const { pass: depleted } = useOwnPrepaidCredit(
      pass,
      { id: "evt-deplete", date: "2026-09-13", creditAmount: 100_000, createdAt: NOW },
      settings
    );

    assert.equal(depleted.remainingBalance, 0);
    assert.equal(depleted.status, "DEPLETED");
  });

  test("이미 종료(CLOSED)된 정액권은 추가 사용을 막는다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(purchaseInput(), settings);
    const closed = closePrepaidPass(pass);

    assert.equal(closed.status, "CLOSED");
    assert.throws(() =>
      useOwnPrepaidCredit(
        closed,
        { id: "evt-closed", date: "2026-09-13", creditAmount: 10_000, createdAt: NOW },
        settings
      )
    );
  });

  test("조정(ADJUSTMENT)이 creditAmount를 초과하면 예외를 던진다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(purchaseInput(), settings);

    assert.throws(() =>
      adjustPrepaidPass(pass, {
        id: "evt-adj-over",
        date: "2026-09-13",
        creditAmountImpact: 1,
        salesImpact: 0,
        settlementImpact: 0,
        createdAt: NOW,
      })
    );
  });

  test("조정(ADJUSTMENT)이 잔액을 음수로 만들면 예외를 던진다", () => {
    const settings = createDefaultSettlementSettings({ baseIncentiveRate: 0.4 });
    const { pass } = purchasePrepaidPass(
      purchaseInput({ paidAmount: 100_000, creditAmount: 100_000 }),
      settings
    );

    assert.throws(() =>
      adjustPrepaidPass(pass, {
        id: "evt-adj-negative",
        date: "2026-09-13",
        creditAmountImpact: -200_000,
        salesImpact: 0,
        settlementImpact: 0,
        createdAt: NOW,
      })
    );
  });
});
