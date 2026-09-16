"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { FieldError, fieldBorderClass } from "@/components/FieldError";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import { useFieldRefs } from "@/components/useFieldRefs";
import { calculatePerUseAmount, purchaseMembershipPass } from "@/lib/settlement/membership";
import {
  MEMBERSHIP_RECOGNITION_MODES,
  MEMBERSHIP_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon, normalizeAmountInput, todayDateString } from "@/lib/settlement/format";
import { loadSettlementSettings, recordMembershipLedgerResult } from "@/lib/settlement/storage";
import type { MembershipRecognitionMode, SettlementSettings } from "@/lib/settlement/types";

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
type MembershipNewFieldErrors = {
  date?: string;
  label?: string;
  paidAmount?: string;
  totalCount?: string;
};

/** 화면에 보이는 순서(위→아래)와 반드시 일치해야 한다. 첫 오류 필드로 scroll+focus할 때 쓴다. */
const MEMBERSHIP_NEW_FIELD_ORDER: readonly (keyof MembershipNewFieldErrors)[] = [
  "date",
  "label",
  "paidAmount",
  "totalCount",
];

/**
 * 신규 등록 폼의 초기값. 날짜(오늘)만 매 리셋 시점에 다시 계산해야 해서 별도로 다룬다.
 * resetForm()과 useState 초기값이 이 한 곳만 바라보게 해, "화면 선택 상태 = 실제 state"가
 * 항상 성립하게 한다. 정산 반영 방식 기본값은 정액권 신규 등록 폼과 동일하게 USE_BASED다.
 */
const INITIAL_MEMBERSHIP_NEW_FORM = {
  label: "",
  paidAmountText: "",
  totalCountText: "",
  recognitionMode: "USE_BASED" as MembershipRecognitionMode,
  memo: "",
};

export default function MembershipNewPage() {
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
  const [label, setLabel] = useState(INITIAL_MEMBERSHIP_NEW_FORM.label);
  const [paidAmountText, setPaidAmountText] = useState(
    INITIAL_MEMBERSHIP_NEW_FORM.paidAmountText
  );
  const [totalCountText, setTotalCountText] = useState(
    INITIAL_MEMBERSHIP_NEW_FORM.totalCountText
  );
  const [recognitionMode, setRecognitionMode] = useState<MembershipRecognitionMode>(
    INITIAL_MEMBERSHIP_NEW_FORM.recognitionMode
  );
  const [memo, setMemo] = useState(INITIAL_MEMBERSHIP_NEW_FORM.memo);
  const [fieldErrors, setFieldErrors] = useState<MembershipNewFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { register, focusFirstError } = useFieldRefs<keyof MembershipNewFieldErrors>();

  /** 폼을 초기 상태로 되돌린다. 날짜는 "오늘"이라 호출 시점에 다시 계산한다. */
  function resetForm() {
    setDate(todayDateString());
    setLabel(INITIAL_MEMBERSHIP_NEW_FORM.label);
    setPaidAmountText(INITIAL_MEMBERSHIP_NEW_FORM.paidAmountText);
    setTotalCountText(INITIAL_MEMBERSHIP_NEW_FORM.totalCountText);
    setRecognitionMode(INITIAL_MEMBERSHIP_NEW_FORM.recognitionMode);
    setMemo(INITIAL_MEMBERSHIP_NEW_FORM.memo);
    setFieldErrors({});
    setFormError(null);
  }

  // 정액권 등록 화면과 동일한 이유(Next.js 16.3의 Activity hidden 상태로 useState가 남는 문제)로,
  // 화면을 실제로 떠날 때 항상 폼을 초기화해 재방문 시 새 등록 폼으로 시작하게 한다.
  useLayoutEffect(() => {
    return () => {
      resetForm();
    };
  }, []);

  const paidAmount = Number(paidAmountText);
  const isPaidAmountValid = Number.isFinite(paidAmount) && paidAmount > 0;
  const totalCount = Number(totalCountText);
  const isTotalCountValid = Number.isInteger(totalCount) && totalCount > 0;
  const perUseAmount =
    isPaidAmountValid && isTotalCountValid ? calculatePerUseAmount(paidAmount, totalCount) : null;

  function handlePaidAmountChange(rawValue: string) {
    setPaidAmountText(normalizeAmountInput(rawValue));
    setFieldErrors((prev) => ({ ...prev, paidAmount: undefined }));
  }

  function handleTotalCountChange(rawValue: string) {
    setTotalCountText(normalizeAmountInput(rawValue));
    setFieldErrors((prev) => ({ ...prev, totalCount: undefined }));
  }

  function validateMembershipNew(): MembershipNewFieldErrors {
    const errors: MembershipNewFieldErrors = {};

    if (!date.trim()) {
      errors.date = "날짜를 입력해주세요.";
    }
    if (!label.trim()) {
      errors.label = "회원권 식별명을 입력해주세요.";
    }
    if (!paidAmountText.trim()) {
      errors.paidAmount = "실결제금액을 입력해주세요.";
    } else if (!isPaidAmountValid) {
      errors.paidAmount = "0보다 큰 금액을 입력해주세요.";
    }
    if (!totalCountText.trim()) {
      errors.totalCount = "사용가능횟수를 입력해주세요.";
    } else if (!isTotalCountValid) {
      errors.totalCount = "0보다 큰 정수(횟수)를 입력해주세요.";
    }

    return errors;
  }

  async function handleSave() {
    if (!settings) return;

    const errors = validateMembershipNew();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors, MEMBERSHIP_NEW_FIELD_ORDER);
      return;
    }

    const now = new Date().toISOString();
    const result = purchaseMembershipPass(
      {
        id: crypto.randomUUID(),
        label: label.trim(),
        purchaseDate: date,
        paidAmount,
        totalCount,
        recognitionMode,
        memo: memo.trim() || undefined,
        createdAt: now,
      },
      settings
    );

    try {
      await recordMembershipLedgerResult(result);
    } catch (e) {
      // 저장 실패 시에는 성공 오버레이/이동 없이 화면에 오류만 남긴다.
      setFormError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      return;
    }

    showSuccess("회원권이 등록되었습니다.");
    router.push(`/membership/${result.pass.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/membership" className="text-sm text-zinc-500">
        ← 회원권 목록으로
      </Link>

      <h1 className="text-xl font-bold">회원권 등록</h1>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">등록일</span>
          <input
            ref={register("date")}
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
          <span className="text-sm text-zinc-500">회원권 식별명 *</span>
          <input
            ref={register("label")}
            type="text"
            placeholder="예: 김OO 클리닉 10회권"
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
            ref={register("paidAmount")}
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
          <span className="text-sm text-zinc-500">사용가능횟수</span>
          <input
            ref={register("totalCount")}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={totalCountText}
            onChange={(e) => handleTotalCountChange(e.target.value)}
            className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.totalCount)}`}
          />
          <FieldError message={fieldErrors.totalCount} />
          {perUseAmount !== null && (
            <p className="mt-1 text-xs text-zinc-500">
              1회 기준 매출{" "}
              <span className="font-semibold text-zinc-900">{formatWon(perUseAmount)}</span>
            </p>
          )}
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-500">정산 반영 방식</legend>
          <ChoiceGroup
            options={MEMBERSHIP_RECOGNITION_MODES}
            value={recognitionMode}
            onChange={setRecognitionMode}
            labels={MEMBERSHIP_RECOGNITION_MODE_LABELS}
          />
          <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
            <p>
              <span className="font-semibold text-zinc-700">사용 시 반영</span> — 판매 시에는
              정산하지 않고, 1회 사용할 때마다 1회 기준 매출을 정산에 반영합니다.
            </p>
            <p className="mt-1">
              <span className="font-semibold text-zinc-700">판매 즉시 반영</span> — 판매한
              시점에 전체 결제금액을 정산에 반영합니다. 이후 본인이 사용할 때는 횟수만
              차감되고 중복으로 정산하지 않습니다.
            </p>
          </div>
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
