// 회원권(횟수 차감형) 계산/원장 엔진. 순수 함수로만 구성하며 UI/저장소를 알지 못한다.
//
// 정액권(prepaid.ts)과 별개의 상품이다 — 정액권은 "금액 잔액"을 차감하지만 회원권은
// "횟수"를 차감한다. MVP 단순화는 정액권 엔진과 동일한 원칙을 따른다: VAT/카드수수료/
// 재료비는 회원권 매출 인식에 적용하지 않고 settings.baseIncentiveRate만 사용한다
// (회원권 자체에는 customerType/paymentType 개념이 없어 calculateSettlement를 재사용할 수 없다).
// 기존 일반 Transaction 엔진과 정액권 엔진은 이 파일에서 전혀 수정하지 않았다.

import type {
  MembershipEvent,
  MembershipPass,
  MembershipPassStatus,
  MembershipRecognitionMode,
  SettlementSettings,
} from "./types.ts";

export interface MembershipLedgerResult {
  pass: MembershipPass;
  event: MembershipEvent;
}

export interface CreateMembershipPassInput {
  id: string;
  label: string;
  purchaseDate: string;
  paidAmount: number;
  totalCount: number;
  recognitionMode: MembershipRecognitionMode;
  memo?: string;
  createdAt: string;
}

export interface MembershipUseInput {
  id: string;
  date: string;
  /** 차감할 횟수. 기본 1회, 항상 0보다 큰 정수. */
  count: number;
  memo?: string;
  createdAt: string;
}

export interface MembershipAdjustmentInput {
  id: string;
  date: string;
  countImpact: number;
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

function assertPositiveInteger(count: number): void {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("횟수는 0보다 큰 정수여야 합니다.");
  }
}

function assertActive(pass: MembershipPass): void {
  if (pass.status === "CLOSED") {
    throw new Error("이미 종료된 회원권입니다.");
  }
}

function assertSufficientCount(pass: MembershipPass, count: number): void {
  if (count > pass.remainingCount) {
    throw new Error("회원권 남은 횟수를 초과하는 사용입니다.");
  }
}

function nextStatus(
  remainingCount: number,
  currentStatus: MembershipPassStatus
): MembershipPassStatus {
  if (currentStatus === "CLOSED") return "CLOSED";
  return remainingCount <= 0 ? "DEPLETED" : "ACTIVE";
}

/** 1회 기준 매출 (원 단위 반올림). totalCount가 0 이하면 방어적으로 0을 반환한다. */
export function calculatePerUseAmount(paidAmount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Math.round(paidAmount / totalCount);
}

export function closeMembershipPass(pass: MembershipPass): MembershipPass {
  return { ...pass, status: "CLOSED" };
}

/** 남은 횟수를 이벤트 이력만으로 재계산한다 (countImpact 합). 저장된 remainingCount 검증용. */
export function calculateRemainingCountFromEvents(
  passId: string,
  events: MembershipEvent[]
): number {
  return events
    .filter((event) => event.membershipPassId === passId)
    .reduce((count, event) => count + event.countImpact, 0);
}

/** 회원권 구매. SALE_IMMEDIATE는 즉시 매출/정산에 반영하고, USE_BASED는 반영하지 않는다. */
export function purchaseMembershipPass(
  input: CreateMembershipPassInput,
  settings: SettlementSettings
): MembershipLedgerResult {
  assertPositiveAmount(input.paidAmount);
  assertPositiveInteger(input.totalCount);

  const pass: MembershipPass = {
    id: input.id,
    label: input.label,
    purchaseDate: input.purchaseDate,
    paidAmount: input.paidAmount,
    totalCount: input.totalCount,
    remainingCount: input.totalCount,
    recognitionMode: input.recognitionMode,
    status: "ACTIVE",
    memo: input.memo,
    createdAt: input.createdAt,
  };

  const commissionRateSnapshot = settings.baseIncentiveRate;
  const isImmediate = input.recognitionMode === "SALE_IMMEDIATE";
  const salesImpact = isImmediate ? input.paidAmount : 0;
  const settlementImpact = isImmediate
    ? Math.round(input.paidAmount * commissionRateSnapshot)
    : 0;

  const event: MembershipEvent = {
    id: input.id,
    membershipPassId: pass.id,
    type: "PURCHASE",
    date: input.purchaseDate,
    countImpact: input.totalCount,
    salesImpact,
    settlementImpact,
    commissionRateSnapshot,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass, event };
}

/**
 * 본인이 회원권을 사용 (기본 1회, count로 여러 회차 지정 가능).
 * SALE_IMMEDIATE는 이미 인식된 매출이라 추가 영향이 없고, USE_BASED는 이 시점에 매출/정산을 인식한다.
 */
export function useOwnMembershipCount(
  pass: MembershipPass,
  input: MembershipUseInput,
  settings: SettlementSettings
): MembershipLedgerResult {
  assertActive(pass);
  assertPositiveInteger(input.count);
  assertSufficientCount(pass, input.count);

  const remainingCount = pass.remainingCount - input.count;
  const updatedPass: MembershipPass = {
    ...pass,
    remainingCount,
    status: nextStatus(remainingCount, pass.status),
  };

  const commissionRateSnapshot = settings.baseIncentiveRate;
  const perUseAmount = calculatePerUseAmount(pass.paidAmount, pass.totalCount);
  let salesImpact = 0;
  let settlementImpact = 0;

  if (pass.recognitionMode === "USE_BASED") {
    salesImpact = perUseAmount * input.count;
    settlementImpact = Math.round(salesImpact * commissionRateSnapshot);
  }

  const event: MembershipEvent = {
    id: input.id,
    membershipPassId: pass.id,
    type: "USE",
    date: input.date,
    countImpact: -input.count,
    salesImpact,
    settlementImpact,
    commissionRateSnapshot,
    perUseAmountSnapshot: perUseAmount,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass: updatedPass, event };
}

/**
 * 타 디자이너가 회원권을 사용.
 * SALE_IMMEDIATE는 구매 시 이미 이 디자이너 매출로 잡혔으므로 환수(음수 반영)한다.
 * USE_BASED는 애초에 반영된 적이 없으므로 영향이 없다.
 */
export function useByOtherDesigner(
  pass: MembershipPass,
  input: MembershipUseInput,
  settings: SettlementSettings
): MembershipLedgerResult {
  assertActive(pass);
  assertPositiveInteger(input.count);
  assertSufficientCount(pass, input.count);

  const remainingCount = pass.remainingCount - input.count;
  const updatedPass: MembershipPass = {
    ...pass,
    remainingCount,
    status: nextStatus(remainingCount, pass.status),
  };

  const commissionRateSnapshot = settings.baseIncentiveRate;
  const perUseAmount = calculatePerUseAmount(pass.paidAmount, pass.totalCount);
  let salesImpact = 0;
  let settlementImpact = 0;

  if (pass.recognitionMode === "SALE_IMMEDIATE") {
    const equivalent = perUseAmount * input.count;
    salesImpact = -equivalent;
    settlementImpact = -Math.round(equivalent * commissionRateSnapshot);
  }

  const event: MembershipEvent = {
    id: input.id,
    membershipPassId: pass.id,
    type: "OTHER_DESIGNER_USE",
    date: input.date,
    countImpact: -input.count,
    salesImpact,
    settlementImpact,
    commissionRateSnapshot,
    perUseAmountSnapshot: perUseAmount,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass: updatedPass, event };
}

/**
 * 자동 계산에 맞지 않는 수동 조정 (예: 입력 실수 정정, 보정 서비스). 값은 호출자가 직접
 * 지정하며, 이 함수는 남은 횟수가 0 미만이거나 totalCount를 초과하지 않는지만 검증한다.
 */
export function adjustMembershipPass(
  pass: MembershipPass,
  input: MembershipAdjustmentInput
): MembershipLedgerResult {
  assertActive(pass);

  const remainingCount = pass.remainingCount + input.countImpact;
  if (remainingCount < 0) {
    throw new Error("회원권 남은 횟수를 초과하는 조정입니다.");
  }
  if (remainingCount > pass.totalCount) {
    throw new Error("회원권 전체 횟수를 초과하는 조정입니다.");
  }

  const updatedPass: MembershipPass = {
    ...pass,
    remainingCount,
    status: nextStatus(remainingCount, pass.status),
  };

  const event: MembershipEvent = {
    id: input.id,
    membershipPassId: pass.id,
    type: "ADJUSTMENT",
    date: input.date,
    countImpact: input.countImpact,
    salesImpact: input.salesImpact,
    settlementImpact: input.settlementImpact,
    memo: input.memo,
    createdAt: input.createdAt,
  };

  return { pass: updatedPass, event };
}
