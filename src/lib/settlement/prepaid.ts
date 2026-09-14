// 정액권(선불권) 계산/원장 엔진. 순수 함수로만 구성하며 UI/저장소를 알지 못한다.
//
// MVP 단순화: VAT/카드수수료/재료비는 정액권 매출 인식에 적용하지 않고
// settings.baseIncentiveRate만 사용한다 (MASTER의 정액권 예시들이 전부 단순 비율 곱셈이며,
// 정액권 자체에는 customerType/paymentType 개념이 없어 calculateSettlement를 재사용할 수 없다).
// 기존 일반 Transaction 엔진(calculateSettlement 등)은 이번 작업에서 수정하지 않았다.

import type {
  BonusSettlementMode,
  PrepaidDiscountSettlementBasis,
  PrepaidEvent,
  PrepaidPass,
  PrepaidPassStatus,
  SettlementSettings,
} from "./types.ts";

export interface PrepaidLedgerResult {
  pass: PrepaidPass;
  event: PrepaidEvent;
}

export interface CreatePrepaidPassInput {
  id: string;
  purchaseDate: string;
  paidAmount: number;
  creditAmount: number;
  recognitionMode: PrepaidPass["recognitionMode"];
  bonusSettlementMode: BonusSettlementMode;
  /** 정액권 사용 할인율 (0~1, 1 미만). 생략하거나 0이면 할인 없는 기존 정액권과 동일하게 동작한다. */
  discountRate?: number;
  discountSettlementBasis?: PrepaidDiscountSettlementBasis;
  label?: string;
  memo?: string;
  createdAt: string;
}

export interface PrepaidCreditEventInput {
  id: string;
  date: string;
  /** 이 이벤트로 차감/환불되는 사용가능액 (항상 0보다 큰 양수로 전달). 할인 정액권이면 이미 할인이 적용된 금액이어야 한다. */
  creditAmount: number;
  /**
   * 할인 정액권 "본인 사용"(useOwnPrepaidCredit) 전용: 할인 전 정상 시술가.
   * 채워지면 이벤트에 그대로 snapshot 저장되고, 매출 인정 기준(ORIGINAL_SERVICE_AMOUNT)일 때
   * 정산 매출 계산의 기준값으로도 쓰인다. 할인이 없는 기존 흐름은 비워둔다.
   */
  serviceAmount?: number;
  memo?: string;
  createdAt: string;
}

export interface PrepaidAdjustmentInput {
  id: string;
  date: string;
  creditAmountImpact: number;
  salesImpact: number;
  settlementImpact: number;
  memo?: string;
  createdAt: string;
}

function assertPositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("금액은 0보다 커야 합니다.");
  }
}

function assertActive(pass: PrepaidPass): void {
  if (pass.status === "CLOSED") {
    throw new Error("이미 종료된 정액권입니다.");
  }
}

function assertSufficientBalance(pass: PrepaidPass, amount: number): void {
  if (amount > pass.remainingBalance) {
    throw new Error("정액권 잔액을 초과하는 금액입니다.");
  }
}

function nextStatus(
  remainingBalance: number,
  currentStatus: PrepaidPassStatus
): PrepaidPassStatus {
  if (currentStatus === "CLOSED") return "CLOSED";
  return remainingBalance <= 0 ? "DEPLETED" : "ACTIVE";
}

/** 보너스 정액권에서 차감된 사용가능액을 정산 대상 매출로 환산한다. */
export function convertCreditToSalesAmount(
  pass: PrepaidPass,
  creditAmount: number
): number {
  if (pass.bonusSettlementMode === "CREDIT_AMOUNT" || pass.creditAmount === 0) {
    return creditAmount;
  }
  return Math.round(creditAmount * (pass.paidAmount / pass.creditAmount));
}

/** 이 기능 이전에 만들어진 정액권(필드 없음)은 할인 0%와 동일하게 취급한다. */
export function resolveDiscountRate(pass: PrepaidPass): number {
  return pass.discountRate ?? 0;
}

/** 이 기능 이전에 만들어진 정액권(필드 없음)은 기존 동작과 같은 DISCOUNTED_AMOUNT로 취급한다. */
export function resolveDiscountSettlementBasis(pass: PrepaidPass): PrepaidDiscountSettlementBasis {
  return pass.discountSettlementBasis ?? "DISCOUNTED_AMOUNT";
}

/** 정상 시술가에 할인율을 적용해 정액권에서 실제 차감할 금액을 계산한다 (원 단위 정수). */
export function calculateDiscountedServiceAmount(
  serviceAmount: number,
  discountRate: number
): number {
  return Math.round(serviceAmount * (1 - discountRate));
}

export function closePrepaidPass(pass: PrepaidPass): PrepaidPass {
  return { ...pass, status: "CLOSED" };
}

/** 잔액을 이벤트 이력만으로 재계산한다 (creditAmountImpact 합). 저장된 remainingBalance 검증용. */
export function calculateBalanceFromEvents(
  passId: string,
  events: PrepaidEvent[]
): number {
  return events
    .filter((event) => event.prepaidPassId === passId)
    .reduce((balance, event) => balance + event.creditAmountImpact, 0);
}

/** 정액권 구매. SALE_IMMEDIATE는 즉시 매출/정산에 반영하고, USE_BASED는 반영하지 않는다. */
export function purchasePrepaidPass(
  input: CreatePrepaidPassInput,
  settings: SettlementSettings
): PrepaidLedgerResult {
  assertPositiveAmount(input.paidAmount);
  assertPositiveAmount(input.creditAmount);

  const pass: PrepaidPass = {
    id: input.id,
    purchaseDate: input.purchaseDate,
    paidAmount: input.paidAmount,
    creditAmount: input.creditAmount,
    remainingBalance: input.creditAmount,
    recognitionMode: input.recognitionMode,
    bonusSettlementMode: input.bonusSettlementMode,
    discountRate: input.discountRate,
    discountSettlementBasis: input.discountSettlementBasis,
    status: "ACTIVE",
    label: input.label,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  const commissionRateSnapshot = settings.baseIncentiveRate;
  const isImmediate = input.recognitionMode === "SALE_IMMEDIATE";
  // 매출 인식은 실결제금액(paidAmount) 기준이다. 보너스로 늘어난 creditAmount는
  // 잔액에는 반영되지만 실제 받은 현금이 아니므로 매출로 잡지 않는다.
  const salesImpact = isImmediate ? input.paidAmount : 0;
  const settlementImpact = isImmediate
    ? Math.round(input.paidAmount * commissionRateSnapshot)
    : 0;

  const event: PrepaidEvent = {
    id: input.id,
    prepaidPassId: pass.id,
    type: "PURCHASE",
    date: input.purchaseDate,
    creditAmountImpact: input.creditAmount,
    salesImpact,
    settlementImpact,
    commissionRateSnapshot,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass, event };
}

/** 본인이 정액권을 사용. SALE_IMMEDIATE는 이미 인식된 매출이라 추가 영향이 없고, USE_BASED는 이 시점에 매출/정산을 인식한다. */
export function useOwnPrepaidCredit(
  pass: PrepaidPass,
  input: PrepaidCreditEventInput,
  settings: SettlementSettings
): PrepaidLedgerResult {
  assertActive(pass);
  assertPositiveAmount(input.creditAmount);
  assertSufficientBalance(pass, input.creditAmount);

  const remainingBalance = pass.remainingBalance - input.creditAmount;
  const updatedPass: PrepaidPass = {
    ...pass,
    remainingBalance,
    status: nextStatus(remainingBalance, pass.status),
  };

  const commissionRateSnapshot = settings.baseIncentiveRate;
  const discountRate = resolveDiscountRate(pass);
  const discountSettlementBasis = resolveDiscountSettlementBasis(pass);
  let salesImpact = 0;
  let settlementImpact = 0;

  if (pass.recognitionMode === "USE_BASED") {
    // 할인 정액권 + 정상 시술가 기준이면 할인 전 금액을, 그 외(할인 없음/할인 후 금액 기준)는
    // 기존과 동일하게 실제 차감액(input.creditAmount)을 매출 환산 기준으로 쓴다.
    const salesBasisAmount =
      discountRate > 0 &&
      discountSettlementBasis === "ORIGINAL_SERVICE_AMOUNT" &&
      input.serviceAmount !== undefined
        ? input.serviceAmount
        : input.creditAmount;
    const salesEquivalent = convertCreditToSalesAmount(pass, salesBasisAmount);
    salesImpact = salesEquivalent;
    settlementImpact = Math.round(salesEquivalent * commissionRateSnapshot);
  }

  const event: PrepaidEvent = {
    id: input.id,
    prepaidPassId: pass.id,
    type: "USE",
    date: input.date,
    creditAmountImpact: -input.creditAmount,
    salesImpact,
    settlementImpact,
    commissionRateSnapshot,
    ...(input.serviceAmount !== undefined
      ? {
          serviceAmountSnapshot: input.serviceAmount,
          discountRateSnapshot: discountRate,
          discountSettlementBasisSnapshot: discountSettlementBasis,
        }
      : {}),
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass: updatedPass, event };
}

/**
 * 타 디자이너가 정액권을 사용.
 * SALE_IMMEDIATE는 구매 시 이미 이 디자이너 매출로 잡혔으므로 환수(음수 반영)한다.
 * USE_BASED는 애초에 반영된 적이 없으므로 영향이 없다.
 */
export function useByOtherDesigner(
  pass: PrepaidPass,
  input: PrepaidCreditEventInput,
  settings: SettlementSettings
): PrepaidLedgerResult {
  assertActive(pass);
  assertPositiveAmount(input.creditAmount);
  assertSufficientBalance(pass, input.creditAmount);

  const remainingBalance = pass.remainingBalance - input.creditAmount;
  const updatedPass: PrepaidPass = {
    ...pass,
    remainingBalance,
    status: nextStatus(remainingBalance, pass.status),
  };

  const commissionRateSnapshot = settings.baseIncentiveRate;
  let salesImpact = 0;
  let settlementImpact = 0;

  if (pass.recognitionMode === "SALE_IMMEDIATE") {
    const salesEquivalent = convertCreditToSalesAmount(pass, input.creditAmount);
    salesImpact = -salesEquivalent;
    settlementImpact = -Math.round(salesEquivalent * commissionRateSnapshot);
  }

  const event: PrepaidEvent = {
    id: input.id,
    prepaidPassId: pass.id,
    type: "OTHER_DESIGNER_USE",
    date: input.date,
    creditAmountImpact: -input.creditAmount,
    salesImpact,
    settlementImpact,
    commissionRateSnapshot,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass: updatedPass, event };
}

/**
 * 정액권 잔액 환불.
 * SALE_IMMEDIATE는 구매 시 인식된 매출 중 환불분을 환수한다.
 * USE_BASED는 아직 매출로 잡힌 적이 없으므로 영향이 없다.
 */
export function refundPrepaidCredit(
  pass: PrepaidPass,
  input: PrepaidCreditEventInput,
  settings: SettlementSettings
): PrepaidLedgerResult {
  assertActive(pass);
  assertPositiveAmount(input.creditAmount);
  assertSufficientBalance(pass, input.creditAmount);

  const remainingBalance = pass.remainingBalance - input.creditAmount;
  const updatedPass: PrepaidPass = {
    ...pass,
    remainingBalance,
    status: nextStatus(remainingBalance, pass.status),
  };

  const commissionRateSnapshot = settings.baseIncentiveRate;
  let salesImpact = 0;
  let settlementImpact = 0;

  if (pass.recognitionMode === "SALE_IMMEDIATE") {
    const salesEquivalent = convertCreditToSalesAmount(pass, input.creditAmount);
    salesImpact = -salesEquivalent;
    settlementImpact = -Math.round(salesEquivalent * commissionRateSnapshot);
  }

  const event: PrepaidEvent = {
    id: input.id,
    prepaidPassId: pass.id,
    type: "REFUND",
    date: input.date,
    creditAmountImpact: -input.creditAmount,
    salesImpact,
    settlementImpact,
    commissionRateSnapshot,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass: updatedPass, event };
}

/**
 * 자동 계산에 맞지 않는 수동 조정 (예: 입력 실수 정정). 값은 호출자가 직접 지정하며,
 * 이 함수는 잔액이 0 미만이거나 creditAmount를 초과하지 않는지만 검증한다.
 */
export function adjustPrepaidPass(
  pass: PrepaidPass,
  input: PrepaidAdjustmentInput
): PrepaidLedgerResult {
  assertActive(pass);

  const remainingBalance = pass.remainingBalance + input.creditAmountImpact;
  if (remainingBalance < 0) {
    throw new Error("정액권 잔액을 초과하는 조정입니다.");
  }
  if (remainingBalance > pass.creditAmount) {
    throw new Error("정액권 사용가능액을 초과하는 조정입니다.");
  }

  const updatedPass: PrepaidPass = {
    ...pass,
    remainingBalance,
    status: nextStatus(remainingBalance, pass.status),
  };

  const event: PrepaidEvent = {
    id: input.id,
    prepaidPassId: pass.id,
    type: "ADJUSTMENT",
    date: input.date,
    creditAmountImpact: input.creditAmountImpact,
    salesImpact: input.salesImpact,
    settlementImpact: input.settlementImpact,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass: updatedPass, event };
}
