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

// --- 정액권 (구조만 정의. 이번 단계에서는 계산 엔진/UI를 만들지 않는다) ---

export type PrepaidRecognitionMode = "ON_PURCHASE" | "ON_USE";

export type PrepaidPassStatus = "ACTIVE" | "DEPLETED" | "CLOSED";

export interface PrepaidPass {
  id: string;
  purchaseDate: string;
  /** 실결제금액 */
  paidAmount: number;
  /** 보너스 포함 사용가능금액. paidAmount와 분리 저장한다. */
  creditAmount: number;
  remainingBalance: number;
  originalOwner: string;
  recognitionMode: PrepaidRecognitionMode;
  status: PrepaidPassStatus;
  createdAt: string;
}

export type PrepaidEventType =
  | "PURCHASE"
  | "USE"
  | "REFUND"
  | "TRANSFER"
  | "ADJUSTMENT";

export interface PrepaidEvent {
  id: string;
  prepaidPassId: string;
  type: PrepaidEventType;
  amount: number;
  owner: string;
  settlementImpact: number;
  date: string;
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
