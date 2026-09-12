// 정산 도메인 타입 정의. UI에서 직접 계산하지 않고 이 타입 + engine.ts만 사용한다.

export type CustomerType = "NEW" | "RETURNING" | "DESIGNATED" | "OTHER";

export type ServiceType =
  | "CUT"
  | "PERM"
  | "COLOR"
  | "CLINIC"
  | "PRODUCT_SALE"
  | "OTHER";

export type PaymentType = "CARD" | "CASH" | "TRANSFER" | "PLATFORM" | "OTHER";

/** 부가세 처리 방식. 현장 표현이 서로 다른 계산을 의미할 수 있어 3가지로 명확히 구분한다. */
export type VatMode =
  | "NONE" // 공제 없음
  | "SIMPLE_10_PERCENT" // 결제금액의 10% 단순 차감
  | "SUPPLY_CONVERSION"; // VAT 포함금액 -> 공급가액 환산 (예: 110,000 / 1.1 = 100,000)

export type MaterialCostMode = "NONE" | "PERCENT" | "FIXED";

export interface MaterialCostSetting {
  mode: MaterialCostMode;
  /** PERCENT: 0~1 비율, FIXED: 원 단위 고정 금액. NONE일 때는 무시된다. */
  value: number;
}

export interface CardFeeSetting {
  enabled: boolean;
  /** 0~1 비율. 결제수단이 CARD인 거래에만 적용된다. */
  rate: number;
}

/** 사용자의 매장 정산 규칙. 싱글턴으로 사용한다 (매장 1개 = 설정 1건). */
export interface SettlementSettings {
  id: string;
  /** 기본 인센티브율 (0~1). customerTypeRates에 없는 고객유형에 적용된다. */
  baseIncentiveRate: number;
  /** 고객유형별 인센티브율 override. 없는 유형은 baseIncentiveRate를 사용한다. */
  customerTypeRates: Partial<Record<CustomerType, number>>;
  vatMode: VatMode;
  cardFee: CardFeeSetting;
  materialCost: MaterialCostSetting;
  /** 3.3% 사업소득 원천징수 예상액 반영 여부 (ON/OFF). */
  withholding3_3: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 한 건의 거래에 대한 정산 계산 결과.
 * Transaction snapshot 필드와 1:1로 대응한다.
 */
export interface SettlementResult {
  amount: number;
  vatMode: VatMode;
  vatDeduction: number;
  supplyAmount: number;
  materialCost: number;
  paymentFee: number;
  settlementBaseAmount: number;
  commissionRate: number;
  settlementAmount: number;
  withholding3_3Applied: boolean;
  /** 3.3% 반영 후 "예상 지급액". 표현상 세후 확정액이 아님을 UI에서 명시해야 한다. */
  estimatedPayoutAmount: number;
}

/**
 * 일반 거래 원장.
 * 저장 당시 적용된 정산율/공제/결과를 snapshot으로 고정한다.
 * 이후 SettlementSettings가 바뀌어도 이 값들은 재계산하지 않는다.
 */
export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  customerType: CustomerType;
  serviceType: ServiceType;
  paymentType: PaymentType;
  commissionRateSnapshot: number;
  vatModeSnapshot: VatMode;
  vatDeduction: number;
  paymentFee: number;
  materialCost: number;
  settlementBaseAmount: number;
  settlementAmount: number;
  withholding3_3Applied: boolean;
  estimatedPayoutAmount: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

// --- 정액권 (선불권) ---
// 이 앱은 단일 헤어 디자이너 개인용이므로 다른 디자이너 계정/직원 목록은 두지 않는다.
// "타 디자이너 사용"은 현재 사용자의 매출/정산에서 환수되는 이벤트로만 표현한다.

/** SALE_IMMEDIATE: 판매 시 즉시 매출/정산 반영. USE_BASED: 실제 사용 시점에 반영. */
export type PrepaidRecognitionMode = "SALE_IMMEDIATE" | "USE_BASED";

/**
 * 보너스 정액권(사용가능액 > 실결제액)에서 사용분의 정산 대상 매출을 환산하는 방식.
 * CREDIT_AMOUNT: 차감된 사용가능액을 그대로 매출로 인정.
 * PAID_RATIO: 실결제 비율로 환산 (예: 220,000 사용, 100만/110만 비율 -> 200,000).
 */
export type BonusSettlementMode = "CREDIT_AMOUNT" | "PAID_RATIO";

export type PrepaidPassStatus = "ACTIVE" | "DEPLETED" | "CLOSED";

export interface PrepaidPass {
  id: string;
  purchaseDate: string;
  /** 실결제금액. SALE_IMMEDIATE 모드의 매출 인식 기준이 된다. */
  paidAmount: number;
  /** 보너스 포함 실제 사용 가능한 총액. paidAmount와 분리 저장한다. */
  creditAmount: number;
  remainingBalance: number;
  recognitionMode: PrepaidRecognitionMode;
  bonusSettlementMode: BonusSettlementMode;
  status: PrepaidPassStatus;
  label?: string;
  memo?: string;
  createdAt: string;
}

export type PrepaidEventType =
  | "PURCHASE"
  | "USE"
  | "OTHER_DESIGNER_USE"
  | "REFUND"
  | "ADJUSTMENT";

/**
 * 정액권 원장 이벤트. 과거 이벤트는 수정하지 않고 새 이벤트를 추가해 이력을 유지한다.
 * 잔액은 이 이벤트들의 creditAmountImpact 합으로 재계산 가능해야 한다.
 */
export interface PrepaidEvent {
  id: string;
  prepaidPassId: string;
  type: PrepaidEventType;
  date: string;
  /** 정액권 잔액(remainingBalance)에 대한 영향. 사용/환불은 음수, 구매/조정 적립은 양수. */
  creditAmountImpact: number;
  /** 현재 디자이너 기준 매출 영향. */
  salesImpact: number;
  /** 현재 디자이너 기준 정산 영향 (이벤트 생성 당시 설정으로 계산해 고정한 snapshot 값). */
  settlementImpact: number;
  /** 이벤트 생성 당시 적용된 인센티브율 snapshot. ADJUSTMENT처럼 자동 계산이 없는 이벤트는 비워둔다. */
  commissionRateSnapshot?: number;
  memo?: string;
  createdAt: string;
}

export type MonthlyAdjustmentType =
  | "BONUS"
  | "FIXED_ALLOWANCE"
  | "DEDUCTION"
  | "CORRECTION";

/** 월 단위 수동 조정 (보너스, 고정수당, 기타 공제, 월말 수정 등). */
export interface MonthlyAdjustment {
  id: string;
  month: string; // YYYY-MM
  type: MonthlyAdjustmentType;
  amount: number;
  memo?: string;
  createdAt: string;
}

/** 월별 실제 지급액 (매장에서 실제로 입금/지급한 금액). 월정산 화면에서 예상 정산액과 비교한다. */
export interface MonthlyActualPayout {
  month: string; // YYYY-MM
  amount: number;
  updatedAt: string;
}
