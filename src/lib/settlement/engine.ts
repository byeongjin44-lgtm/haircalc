// 정산 계산 엔진. 입력 -> 결과가 고정된 순수 함수로만 구성한다.
// UI, storage와 분리되어 있으며 이 파일은 다른 상태를 읽거나 쓰지 않는다.

import type {
  CustomerType,
  MaterialCostSetting,
  PaymentType,
  SettlementResult,
  SettlementSettings,
  Transaction,
  VatMode,
} from "./types.ts";

const WITHHOLDING_3_3_RATE = 0.033;

export function resolveIncentiveRate(
  settings: SettlementSettings,
  customerType: CustomerType
): number {
  return settings.customerTypeRates[customerType] ?? settings.baseIncentiveRate;
}

export function calculateVatDeduction(amount: number, vatMode: VatMode): number {
  switch (vatMode) {
    case "NONE":
      return 0;
    case "SIMPLE_10_PERCENT":
      return Math.round(amount * 0.1);
    case "SUPPLY_CONVERSION":
      return amount - Math.round(amount / 1.1);
  }
}

export function calculateMaterialCost(
  amount: number,
  setting: MaterialCostSetting
): number {
  switch (setting.mode) {
    case "NONE":
      return 0;
    case "PERCENT":
      return Math.round(amount * setting.value);
    case "FIXED":
      return Math.round(setting.value);
  }
}

export function calculateCardFee(
  amount: number,
  paymentType: PaymentType,
  settings: SettlementSettings
): number {
  if (paymentType !== "CARD" || !settings.cardFee.enabled) return 0;
  return Math.round(amount * settings.cardFee.rate);
}

/**
 * 거래 한 건의 정산 결과를 계산한다.
 * 계산 순서: 매출 -> VAT 공제 -> 재료비/카드수수료 공제 -> 인센티브율 적용 -> 3.3% 반영.
 */
export function calculateSettlement(
  amount: number,
  customerType: CustomerType,
  paymentType: PaymentType,
  settings: SettlementSettings
): SettlementResult {
  const vatDeduction = calculateVatDeduction(amount, settings.vatMode);
  const supplyAmount = amount - vatDeduction;
  const materialCost = calculateMaterialCost(amount, settings.materialCost);
  const paymentFee = calculateCardFee(amount, paymentType, settings);

  const settlementBaseAmount = Math.max(
    0,
    supplyAmount - materialCost - paymentFee
  );

  const commissionRate = resolveIncentiveRate(settings, customerType);
  const settlementAmount = Math.round(settlementBaseAmount * commissionRate);

  const estimatedPayoutAmount = settings.withholding3_3
    ? Math.round(settlementAmount * (1 - WITHHOLDING_3_3_RATE))
    : settlementAmount;

  return {
    amount,
    vatMode: settings.vatMode,
    vatDeduction,
    supplyAmount,
    materialCost,
    paymentFee,
    settlementBaseAmount,
    commissionRate,
    settlementAmount,
    withholding3_3Applied: settings.withholding3_3,
    estimatedPayoutAmount,
  };
}

export interface TransactionInput {
  id: string;
  date: string;
  amount: number;
  customerType: CustomerType;
  serviceType: Transaction["serviceType"];
  paymentType: PaymentType;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 거래 저장 시점의 계산 결과를 Transaction snapshot으로 고정한다.
 * 이후 settings가 바뀌어도 반환된 Transaction 값은 다시 계산되지 않는다.
 */
export function buildTransactionSnapshot(
  input: TransactionInput,
  settings: SettlementSettings
): Transaction {
  const result = calculateSettlement(
    input.amount,
    input.customerType,
    input.paymentType,
    settings
  );

  return {
    id: input.id,
    date: input.date,
    amount: input.amount,
    customerType: input.customerType,
    serviceType: input.serviceType,
    paymentType: input.paymentType,
    commissionRateSnapshot: result.commissionRate,
    vatModeSnapshot: result.vatMode,
    vatDeduction: result.vatDeduction,
    paymentFee: result.paymentFee,
    materialCost: result.materialCost,
    settlementBaseAmount: result.settlementBaseAmount,
    settlementAmount: result.settlementAmount,
    withholding3_3Applied: result.withholding3_3Applied,
    estimatedPayoutAmount: result.estimatedPayoutAmount,
    memo: input.memo,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function createDefaultSettlementSettings(
  overrides: Partial<SettlementSettings> = {}
): SettlementSettings {
  const now = new Date().toISOString();
  return {
    id: "default",
    baseIncentiveRate: 0.4,
    customerTypeRates: {},
    vatMode: "NONE",
    cardFee: { enabled: false, rate: 0 },
    materialCost: { mode: "NONE", value: 0 },
    withholding3_3: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
