import type {
  BonusSettlementMode,
  CustomerType,
  MaterialCostMode,
  PaymentType,
  PrepaidEventType,
  PrepaidPassStatus,
  PrepaidRecognitionMode,
  ServiceType,
  VatMode,
} from "./types.ts";

export const CUSTOMER_TYPES: readonly CustomerType[] = [
  "NEW",
  "RETURNING",
  "DESIGNATED",
  "OTHER",
];

export const SERVICE_TYPES: readonly ServiceType[] = [
  "CUT",
  "PERM",
  "COLOR",
  "CLINIC",
  "PRODUCT_SALE",
  "OTHER",
];

export const PAYMENT_TYPES: readonly PaymentType[] = [
  "CARD",
  "CASH",
  "TRANSFER",
  "PLATFORM",
  "OTHER",
];

export const VAT_MODES: readonly VatMode[] = [
  "NONE",
  "SIMPLE_10_PERCENT",
  "SUPPLY_CONVERSION",
];

export const MATERIAL_COST_MODES: readonly MaterialCostMode[] = [
  "NONE",
  "PERCENT",
  "FIXED",
];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  NEW: "신규",
  RETURNING: "재방문",
  DESIGNATED: "지정",
  OTHER: "기타",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  CUT: "컷",
  PERM: "펌",
  COLOR: "염색",
  CLINIC: "클리닉",
  PRODUCT_SALE: "제품판매",
  OTHER: "기타",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  CARD: "카드",
  CASH: "현금",
  TRANSFER: "계좌이체",
  PLATFORM: "플랫폼",
  OTHER: "기타",
};

export const VAT_MODE_LABELS: Record<VatMode, string> = {
  NONE: "공제 없음",
  SIMPLE_10_PERCENT: "10% 단순 차감",
  SUPPLY_CONVERSION: "공급가액 환산 (VAT 포함금액 ÷ 1.1)",
};

export const MATERIAL_COST_MODE_LABELS: Record<MaterialCostMode, string> = {
  NONE: "사용 안 함",
  PERCENT: "비율(%)",
  FIXED: "고정금액(원)",
};

/** 화면 표시 순서. 기본값(SALE_IMMEDIATE)은 이 순서와 무관하게 유지된다. */
export const PREPAID_RECOGNITION_MODES: readonly PrepaidRecognitionMode[] = [
  "USE_BASED",
  "SALE_IMMEDIATE",
];

/** 화면 표시 순서. 기본값(CREDIT_AMOUNT)은 이 순서와 무관하게 유지된다. */
export const BONUS_SETTLEMENT_MODES: readonly BonusSettlementMode[] = [
  "PAID_RATIO",
  "CREDIT_AMOUNT",
];

export const PREPAID_RECOGNITION_MODE_LABELS: Record<PrepaidRecognitionMode, string> = {
  SALE_IMMEDIATE: "판매 즉시 반영",
  USE_BASED: "사용 시 반영",
};

export const BONUS_SETTLEMENT_MODE_LABELS: Record<BonusSettlementMode, string> = {
  CREDIT_AMOUNT: "차감금액 기준",
  PAID_RATIO: "실결제 비율 환산",
};

export const PREPAID_EVENT_TYPE_LABELS: Record<PrepaidEventType, string> = {
  PURCHASE: "정액권 구매",
  USE: "본인 사용",
  OTHER_DESIGNER_USE: "타 디자이너 사용",
  REFUND: "환불",
  ADJUSTMENT: "조정",
};

export const PREPAID_PASS_STATUS_LABELS: Record<PrepaidPassStatus, string> = {
  ACTIVE: "사용 가능",
  DEPLETED: "소진",
  CLOSED: "종료",
};
