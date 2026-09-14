"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { FieldError, fieldBorderClass } from "@/components/FieldError";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import { calculateDiscountedServiceAmount, purchasePrepaidPass } from "@/lib/settlement/prepaid";
import {
  BONUS_SETTLEMENT_MODES,
  BONUS_SETTLEMENT_MODE_LABELS,
  PREPAID_DISCOUNT_SETTLEMENT_BASES,
  PREPAID_DISCOUNT_SETTLEMENT_BASIS_LABELS,
  PREPAID_RECOGNITION_MODES,
  PREPAID_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { applyBonusRate, formatWon, percentToRate, todayDateString } from "@/lib/settlement/format";
import { loadSettlementSettings, recordPrepaidLedgerResult } from "@/lib/settlement/storage";
import type {
  BonusSettlementMode,
  PrepaidDiscountSettlementBasis,
  PrepaidRecognitionMode,
  SettlementSettings,
} from "@/lib/settlement/types";

function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`min-h-[40px] rounded-full border px-4 py-2 text-sm ${
            value === option
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-700"
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

/** 정액권 등록 화면의 보너스 빠른 선택 옵션. bonusRate는 UI 편의값일 뿐 저장되는 데이터 모델에는 없다. */
const BONUS_RATE_OPTIONS: readonly { rate: number; label: string }[] = [
  { rate: 0, label: "보너스 없음 0%" },
  { rate: 0.05, label: "+5%" },
  { rate: 0.1, label: "+10%" },
  { rate: 0.15, label: "+15%" },
  { rate: 0.2, label: "+20%" },
  { rate: 0.3, label: "+30%" },
];

/** 정액권 사용 할인율 빠른 선택. 0이면 "없음", 그 외는 숫자 입력창에 직접 값을 넣어도 된다. */
const DISCOUNT_RATE_QUICK_OPTIONS: readonly number[] = [0, 5, 10, 15, 20];

/** 저장 시도 후에만 채워지는 필드별 오류. */
type PrepaidNewFieldErrors = {
  date?: string;
  label?: string;
  paidAmount?: string;
  creditAmount?: string;
  discountRate?: string;
};

/**
 * 신규 등록 폼의 초기값. 날짜(오늘)만 매 리셋 시점에 다시 계산해야 해서 별도로 다룬다.
 * resetForm()과 useState 초기값이 이 한 곳만 바라보게 해, "화면 선택 상태 = 실제 state"가
 * 항상 성립하게 한다.
 */
const INITIAL_PREPAID_NEW_FORM = {
  label: "",
  paidAmountText: "",
  creditAmountText: "",
  creditTouched: false,
  bonusRateText: "0",
  recognitionMode: "SALE_IMMEDIATE" as PrepaidRecognitionMode,
  bonusSettlementMode: "CREDIT_AMOUNT" as BonusSettlementMode,
  discountRateText: "0",
  discountSettlementBasis: "DISCOUNTED_AMOUNT" as PrepaidDiscountSettlementBasis,
  memo: "",
};

export default function PrepaidNewPage() {
  const router = useRouter();
  const { showSuccess } = useSuccessOverlay();
  const [settings, setSettings] = useState<SettlementSettings | null>(null);

  useEffect(() => {
    (async () => {
      const loadedSettings = await loadSettlementSettings();
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setSettings(loadedSettings);
    })();
  }, []);

  const [date, setDate] = useState(todayDateString());
  const [label, setLabel] = useState(INITIAL_PREPAID_NEW_FORM.label);
  const [paidAmountText, setPaidAmountText] = useState(INITIAL_PREPAID_NEW_FORM.paidAmountText);
  const [creditAmountText, setCreditAmountText] = useState(
    INITIAL_PREPAID_NEW_FORM.creditAmountText
  );
  const [creditTouched, setCreditTouched] = useState(INITIAL_PREPAID_NEW_FORM.creditTouched);
  const [bonusRateText, setBonusRateText] = useState(INITIAL_PREPAID_NEW_FORM.bonusRateText);
  const [recognitionMode, setRecognitionMode] = useState<PrepaidRecognitionMode>(
    INITIAL_PREPAID_NEW_FORM.recognitionMode
  );
  const [bonusSettlementMode, setBonusSettlementMode] = useState<BonusSettlementMode>(
    INITIAL_PREPAID_NEW_FORM.bonusSettlementMode
  );
  const [discountRateText, setDiscountRateText] = useState(
    INITIAL_PREPAID_NEW_FORM.discountRateText
  );
  const [discountSettlementBasis, setDiscountSettlementBasis] =
    useState<PrepaidDiscountSettlementBasis>(INITIAL_PREPAID_NEW_FORM.discountSettlementBasis);
  const [memo, setMemo] = useState(INITIAL_PREPAID_NEW_FORM.memo);
  const [fieldErrors, setFieldErrors] = useState<PrepaidNewFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  /** 폼을 초기 상태로 되돌린다. 날짜는 "오늘"이라 호출 시점에 다시 계산한다. */
  function resetForm() {
    setDate(todayDateString());
    setLabel(INITIAL_PREPAID_NEW_FORM.label);
    setPaidAmountText(INITIAL_PREPAID_NEW_FORM.paidAmountText);
    setCreditAmountText(INITIAL_PREPAID_NEW_FORM.creditAmountText);
    setCreditTouched(INITIAL_PREPAID_NEW_FORM.creditTouched);
    setBonusRateText(INITIAL_PREPAID_NEW_FORM.bonusRateText);
    setRecognitionMode(INITIAL_PREPAID_NEW_FORM.recognitionMode);
    setBonusSettlementMode(INITIAL_PREPAID_NEW_FORM.bonusSettlementMode);
    setDiscountRateText(INITIAL_PREPAID_NEW_FORM.discountRateText);
    setDiscountSettlementBasis(INITIAL_PREPAID_NEW_FORM.discountSettlementBasis);
    setMemo(INITIAL_PREPAID_NEW_FORM.memo);
    setFieldErrors({});
    setFormError(null);
  }

  // Next.js 16.3부터 라우트를 떠나도 곧바로 언마운트되지 않고 Activity로 hidden 상태만 되면서
  // useState 값을 그대로 들고 있을 수 있다 — 그대로 두면 이 화면을 재방문했을 때 직전 등록
  // 값이 남아있는 채로 다시 저장될 위험이 있다. cleanup에서 폼을 초기화해, hidden/unmount
  // 시점에 항상 리셋되고 다시 보여질 때는 새 등록 폼으로 시작하게 한다.
  useLayoutEffect(() => {
    return () => {
      resetForm();
    };
  }, []);

  const paidAmount = Number(paidAmountText);
  const creditAmount = Number(creditAmountText);
  const discountRatePercent = Number(discountRateText);
  const isDiscountRateValid =
    Number.isFinite(discountRatePercent) && discountRatePercent >= 0 && discountRatePercent < 100;
  const discountRate = isDiscountRateValid ? percentToRate(discountRateText) : 0;
  const hasDiscount = isDiscountRateValid && discountRate > 0;

  function handlePaidAmountChange(value: string) {
    setPaidAmountText(value);
    if (!creditTouched) setCreditAmountText(value);
    setFieldErrors((prev) => ({ ...prev, paidAmount: undefined }));
  }

  function handleCreditAmountChange(value: string) {
    setCreditAmountText(value);
    setCreditTouched(true);
    setFieldErrors((prev) => ({ ...prev, creditAmount: undefined }));
  }

  function handleBonusRateChange(value: string) {
    setBonusRateText(value);
    const rate = Number(value);
    if (Number.isFinite(paidAmount) && paidAmount > 0 && Number.isFinite(rate)) {
      setCreditAmountText(String(applyBonusRate(paidAmount, rate)));
      setCreditTouched(true);
      setFieldErrors((prev) => ({ ...prev, creditAmount: undefined }));
    }
  }

  function validatePrepaidNew(): PrepaidNewFieldErrors {
    const errors: PrepaidNewFieldErrors = {};

    if (!date.trim()) {
      errors.date = "날짜를 입력해주세요.";
    }
    if (!label.trim()) {
      errors.label = "정액권 식별명을 입력해주세요.";
    }
    if (!paidAmountText.trim()) {
      errors.paidAmount = "실결제금액을 입력해주세요.";
    } else if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      errors.paidAmount = "0보다 큰 금액을 입력해주세요.";
    }
    if (!creditAmountText.trim()) {
      errors.creditAmount = "사용가능금액을 입력해주세요.";
    } else if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      errors.creditAmount = "0보다 큰 금액을 입력해주세요.";
    }
    if (!isDiscountRateValid) {
      errors.discountRate = "0 이상 100 미만의 할인율을 입력해주세요.";
    }

    return errors;
  }

  async function handleSave() {
    if (!settings) return;

    const errors = validatePrepaidNew();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    const now = new Date().toISOString();
    const result = purchasePrepaidPass(
      {
        id: crypto.randomUUID(),
        purchaseDate: date,
        paidAmount,
        creditAmount,
        recognitionMode,
        bonusSettlementMode,
        discountRate,
        discountSettlementBasis,
        label: label.trim() || undefined,
        memo: memo.trim() || undefined,
        createdAt: now,
      },
      settings
    );

    try {
      await recordPrepaidLedgerResult(result);
    } catch (e) {
      // 저장 실패 시에는 성공 오버레이/이동 없이 화면에 오류만 남긴다.
      setFormError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      return;
    }

    showSuccess("정액권이 등록되었습니다.");
    router.push(`/prepaid/${result.pass.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/prepaid" className="text-sm text-zinc-500">
        ← 정액권 목록으로
      </Link>

      <h1 className="text-xl font-bold">정액권 등록</h1>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">등록일</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setFieldErrors((prev) => ({ ...prev, date: undefined }));
            }}
            className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.date)}`}
          />
          <FieldError message={fieldErrors.date} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">정액권 식별명 *</span>
          <input
            type="text"
            placeholder="예: OO고객 100만원권"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setFieldErrors((prev) => ({ ...prev, label: undefined }));
            }}
            className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.label)}`}
          />
          <FieldError message={fieldErrors.label} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">실결제금액</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={paidAmountText}
            onChange={(e) => handlePaidAmountChange(e.target.value)}
            className={`rounded-xl border px-4 py-4 text-3xl font-bold tabular-nums ${fieldBorderClass(!!fieldErrors.paidAmount)}`}
          />
          <FieldError message={fieldErrors.paidAmount} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">
            사용가능금액 (보너스 포함, 기본값은 실결제금액과 동일)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={creditAmountText}
            onChange={(e) => handleCreditAmountChange(e.target.value)}
            className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.creditAmount)}`}
          />
          <FieldError message={fieldErrors.creditAmount} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">보너스</span>
          <select
            value={bonusRateText}
            onChange={(e) => handleBonusRateChange(e.target.value)}
            className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
          >
            {BONUS_RATE_OPTIONS.map((option) => (
              <option key={option.rate} value={option.rate}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-500">정산 방식</legend>
          <ChoiceGroup
            options={PREPAID_RECOGNITION_MODES}
            value={recognitionMode}
            onChange={setRecognitionMode}
            labels={PREPAID_RECOGNITION_MODE_LABELS}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-500">보너스 정산 방식</legend>
          <ChoiceGroup
            options={BONUS_SETTLEMENT_MODES}
            value={bonusSettlementMode}
            onChange={setBonusSettlementMode}
            labels={BONUS_SETTLEMENT_MODE_LABELS}
          />
          <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
            <p>
              <span className="font-semibold text-zinc-700">실결제 비율 환산</span> — 보너스를
              제외하고 실제 결제한 비율만 매출로 계산합니다.
            </p>
            <p className="mt-1">
              <span className="font-semibold text-zinc-700">차감금액 기준</span> — 정액권에서
              차감된 금액 전체를 매출로 계산합니다.
            </p>
            <p className="mt-1">
              예) 100만원 결제 / 110만원 사용가능 중 22만원 사용 시 → 실결제비율환산 20만원 인정,
              차감금액기준 22만원 인정. 보너스가 없는 정액권은 두 방식의 결과가 같습니다.
            </p>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">정액권 사용 할인율 (%)</span>
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_RATE_QUICK_OPTIONS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setDiscountRateText(String(pct));
                  setFieldErrors((prev) => ({ ...prev, discountRate: undefined }));
                }}
                className={`min-h-[40px] rounded-full border px-4 py-2 text-sm ${
                  discountRateText === String(pct)
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 text-zinc-700"
                }`}
              >
                {pct === 0 ? "없음" : `${pct}%`}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={99}
            placeholder="직접 입력"
            value={discountRateText}
            onChange={(e) => {
              setDiscountRateText(e.target.value);
              setFieldErrors((prev) => ({ ...prev, discountRate: undefined }));
            }}
            className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.discountRate)}`}
          />
          <FieldError message={fieldErrors.discountRate} />
        </label>

        {hasDiscount && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-zinc-500">할인 정산 기준</legend>
            <ChoiceGroup
              options={PREPAID_DISCOUNT_SETTLEMENT_BASES}
              value={discountSettlementBasis}
              onChange={setDiscountSettlementBasis}
              labels={PREPAID_DISCOUNT_SETTLEMENT_BASIS_LABELS}
            />
            <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
              <p>
                <span className="font-semibold text-zinc-700">할인 후 금액 기준</span> —
                정액권에서 실제 차감된 금액을 매출 기준으로 사용합니다.
              </p>
              <p className="mt-1">
                <span className="font-semibold text-zinc-700">정상 시술가 기준</span> — 고객에게
                할인은 적용하지만 디자이너 매출은 원래 시술가 기준으로 계산합니다.
              </p>
              <p className="mt-1">
                예) 정상가 100,000원 · 할인 {discountRatePercent}% → 정액권{" "}
                {formatWon(calculateDiscountedServiceAmount(100000, discountRate))} 차감
                (동일) · 매출 기준은 할인 후 금액 기준{" "}
                {formatWon(calculateDiscountedServiceAmount(100000, discountRate))} vs 정상
                시술가 기준 {formatWon(100000)}
              </p>
            </div>
          </fieldset>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">메모 (선택)</span>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <button
          type="button"
          onClick={handleSave}
          className="mt-2 min-h-[52px] rounded-xl bg-zinc-900 py-4 text-center text-base font-semibold text-white"
        >
          등록 저장
        </button>

        {formError && (
          <p className="rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-600">
            {formError}
          </p>
        )}
      </div>
    </div>
  );
}
