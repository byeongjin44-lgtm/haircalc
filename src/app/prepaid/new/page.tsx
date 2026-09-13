"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FieldError, fieldBorderClass } from "@/components/FieldError";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import { purchasePrepaidPass } from "@/lib/settlement/prepaid";
import {
  BONUS_SETTLEMENT_MODES,
  BONUS_SETTLEMENT_MODE_LABELS,
  PREPAID_RECOGNITION_MODES,
  PREPAID_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { todayDateString } from "@/lib/settlement/format";
import { loadSettlementSettings, recordPrepaidLedgerResult } from "@/lib/settlement/storage";
import type { BonusSettlementMode, PrepaidRecognitionMode, SettlementSettings } from "@/lib/settlement/types";

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

/** 저장 시도 후에만 채워지는 필드별 오류. */
type PrepaidNewFieldErrors = {
  date?: string;
  label?: string;
  paidAmount?: string;
  creditAmount?: string;
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
  const [label, setLabel] = useState("");
  const [paidAmountText, setPaidAmountText] = useState("");
  const [creditAmountText, setCreditAmountText] = useState("");
  const [creditTouched, setCreditTouched] = useState(false);
  const [recognitionMode, setRecognitionMode] =
    useState<PrepaidRecognitionMode>("SALE_IMMEDIATE");
  const [bonusSettlementMode, setBonusSettlementMode] =
    useState<BonusSettlementMode>("CREDIT_AMOUNT");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PrepaidNewFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const paidAmount = Number(paidAmountText);
  const creditAmount = Number(creditAmountText);

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
        </fieldset>

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
