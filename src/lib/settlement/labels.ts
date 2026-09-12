import type {
  CustomerType,
  MaterialCostMode,
  PaymentType,
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
