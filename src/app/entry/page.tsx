"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { FieldError, fieldBorderClass } from "@/components/FieldError";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import { useFieldRefs } from "@/components/useFieldRefs";
import { buildTransactionSnapshot, calculateSettlement } from "@/lib/settlement/engine";
import {
  calculateDiscountedServiceAmount,
  resolveDiscountRate,
  useOwnPrepaidCredit as applyOwnUse,
} from "@/lib/settlement/prepaid";
import { useOwnMembershipCount as applyOwnMembershipUse } from "@/lib/settlement/membership";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from "@/lib/settlement/labels";
import {
  formatSignedWon,
  formatWon,
  normalizeAmountInput,
  todayDateString,
} from "@/lib/settlement/format";
import {
  appendTransaction,
  loadMembershipPasses,
  loadPrepaidPasses,
  loadSettlementSettings,
  recordMembershipLedgerResult,
  recordPrepaidLedgerResult,
} from "@/lib/settlement/storage";
import type {
  CustomerType,
  MembershipPass,
  PaymentType,
  PrepaidPass,
  ServiceType,
  SettlementSettings,
} from "@/lib/settlement/types";

function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  labels,
  containerRef,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels: Record<T, string>;
  /** validation 실패 시 첫 오류 필드로 scroll+focus하기 위한 wrapper ref (useFieldRefs.register). */
  containerRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={containerRef} tabIndex={-1} className="flex flex-wrap gap-2 outline-none">
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

/** 거래등록 화면에서만 쓰는 UI 전용 선택지. PaymentType(엔진/데이터 구조)에는 없는 값이다. */
type PaymentChoice = PaymentType | "PREPAID" | "MEMBERSHIP";

const PAYMENT_CHOICES: readonly PaymentChoice[] = [...PAYMENT_TYPES, "PREPAID", "MEMBERSHIP"];

const PAYMENT_CHOICE_LABELS: Record<PaymentChoice, string> = {
  ...PAYMENT_TYPE_LABELS,
  PREPAID: "정액권",
  MEMBERSHIP: "회원권",
};

/** 저장 시도 후에만 채워지는 필드별 오류. 값이 있으면 해당 필드 아래 빨간 문구/빨간 테두리로 표시한다. */
type EntryFieldErrors = {
  date?: string;
  amount?: string;
  customerType?: string;
  serviceType?: string;
  paymentType?: string;
  prepaidPass?: string;
  membershipPass?: string;
};

/** 화면에 보이는 순서(위→아래)와 반드시 일치해야 한다. 첫 오류 필드로 scroll+focus할 때 쓴다. */
const ENTRY_FIELD_ORDER: readonly (keyof EntryFieldErrors)[] = [
  "date",
  "amount",
  "customerType",
  "serviceType",
  "paymentType",
  "prepaidPass",
  "membershipPass",
];

/**
 * 거래등록 폼의 초기값. 날짜(오늘)만 매 리셋 시점에 다시 계산해야 해서 별도로 다룬다.
 * 저장 성공 후 "연속 입력 편의성"(날짜/고객유형/시술유형/결제수단 유지)을 위한 부분
 * 초기화와는 다르게, 이 값은 route를 실제로 떠났다가 돌아왔을 때의 전체 초기화에만 쓴다.
 */
const INITIAL_ENTRY_FORM = {
  amountText: "",
  customerType: "OTHER" as CustomerType,
  serviceType: "CUT" as ServiceType,
  paymentChoice: "CASH" as PaymentChoice,
  selectedPassId: "",
  selectedMembershipPassId: "",
  memo: "",
};

export default function EntryPage() {
  const { showSuccess } = useSuccessOverlay();
  const [settings, setSettings] = useState<SettlementSettings | null>(null);
  const [prepaidPasses, setPrepaidPasses] = useState<PrepaidPass[]>([]);
  const [membershipPasses, setMembershipPasses] = useState<MembershipPass[]>([]);

  const [date, setDate] = useState(todayDateString());
  const [amountText, setAmountText] = useState(INITIAL_ENTRY_FORM.amountText);
  const [customerType, setCustomerType] = useState<CustomerType>(
    INITIAL_ENTRY_FORM.customerType
  );
  const [serviceType, setServiceType] = useState<ServiceType>(INITIAL_ENTRY_FORM.serviceType);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>(
    INITIAL_ENTRY_FORM.paymentChoice
  );
  const [selectedPassId, setSelectedPassId] = useState(INITIAL_ENTRY_FORM.selectedPassId);
  const [selectedMembershipPassId, setSelectedMembershipPassId] = useState(
    INITIAL_ENTRY_FORM.selectedMembershipPassId
  );
  const [memo, setMemo] = useState(INITIAL_ENTRY_FORM.memo);
  const [fieldErrors, setFieldErrors] = useState<EntryFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { register, focusFirstError } = useFieldRefs<keyof EntryFieldErrors>();

  /** route를 실제로 떠났다가 돌아왔을 때만 쓰는 전체 초기화. 날짜는 호출 시점에 다시 계산한다. */
  function resetForm() {
    setDate(todayDateString());
    setAmountText(INITIAL_ENTRY_FORM.amountText);
    setCustomerType(INITIAL_ENTRY_FORM.customerType);
    setServiceType(INITIAL_ENTRY_FORM.serviceType);
    setPaymentChoice(INITIAL_ENTRY_FORM.paymentChoice);
    setSelectedPassId(INITIAL_ENTRY_FORM.selectedPassId);
    setSelectedMembershipPassId(INITIAL_ENTRY_FORM.selectedMembershipPassId);
    setMemo(INITIAL_ENTRY_FORM.memo);
    setFieldErrors({});
    setFormError(null);
  }

  // Next.js 16.3부터 라우트를 떠나도 곧바로 언마운트되지 않고 Activity로 hidden 상태만 되면서
  // useState 값을 그대로 들고 있을 수 있다. 저장 성공 후 같은 화면에 남아있을 때의 부분
  // 초기화(아래 handleSave, 금액/메모만 리셋)와는 별개로, 이 cleanup은 화면을 실제로 떠날
  // 때(hidden 전환/언마운트)만 전체 폼을 초기화해 재방문 시 항상 새 거래 폼으로 시작하게 한다.
  useLayoutEffect(() => {
    return () => {
      resetForm();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const [loadedSettings, loadedPasses, loadedMembershipPasses] = await Promise.all([
        loadSettlementSettings(),
        loadPrepaidPasses(),
        loadMembershipPasses(),
      ]);
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setSettings(loadedSettings);
      setPrepaidPasses(loadedPasses.filter((p) => p.status === "ACTIVE"));
      setMembershipPasses(loadedMembershipPasses.filter((p) => p.status === "ACTIVE"));
    })();
  }, []);

  const isPrepaidPayment = paymentChoice === "PREPAID";
  const isMembershipPayment = paymentChoice === "MEMBERSHIP";
  const selectedPass = prepaidPasses.find((p) => p.id === selectedPassId) ?? null;
  const selectedMembershipPass =
    membershipPasses.find((p) => p.id === selectedMembershipPassId) ?? null;

  const amount = Number(amountText);
  const isAmountValid = Number.isFinite(amount) && amount > 0;

  // 선택한 정액권에 사용 할인율이 있으면 입력값은 "정상 시술가"이고, 정액권에서는
  // 할인이 적용된 금액만 차감된다. 할인이 없으면 입력값이 곧 차감액(기존 동작 그대로).
  const passDiscountRate = selectedPass ? resolveDiscountRate(selectedPass) : 0;
  const hasDiscount = isPrepaidPayment && passDiscountRate > 0;
  const discountedAmount =
    hasDiscount && isAmountValid ? calculateDiscountedServiceAmount(amount, passDiscountRate) : amount;

  const transactionPreview = useMemo(() => {
    if (!settings || isPrepaidPayment || !isAmountValid) return null;
    return calculateSettlement(amount, customerType, paymentChoice as PaymentType, settings);
  }, [settings, isPrepaidPayment, isAmountValid, amount, customerType, paymentChoice]);

  function computePrepaidUsePreview() {
    if (!settings || !isPrepaidPayment || !selectedPass || !isAmountValid) return null;
    try {
      return applyOwnUse(
        selectedPass,
        {
          id: "preview",
          date,
          creditAmount: discountedAmount,
          serviceAmount: hasDiscount ? amount : undefined,
          createdAt: new Date().toISOString(),
        },
        settings
      );
    } catch {
      return null;
    }
  }
  const prepaidUsePreview = computePrepaidUsePreview();

  // 회원권은 금액 입력이 없다 — 1회 사용 고정, 매출은 회원권 자체의 (실결제금액/전체횟수)로 정해진다.
  function computeMembershipUsePreview() {
    if (!settings || !isMembershipPayment || !selectedMembershipPass) return null;
    try {
      return applyOwnMembershipUse(
        selectedMembershipPass,
        { id: "preview", date, count: 1, createdAt: new Date().toISOString() },
        settings
      );
    } catch {
      return null;
    }
  }
  const membershipUsePreview = computeMembershipUsePreview();

  /** 저장 시도 시점에만 호출한다. 필드별 오류를 계산해 반환하고, 화면에는 setFieldErrors로 반영한다. */
  function validateEntry(): EntryFieldErrors {
    const errors: EntryFieldErrors = {};

    if (!date.trim()) {
      errors.date = "날짜를 입력해주세요.";
    }

    if (!isMembershipPayment) {
      if (!amountText.trim()) {
        errors.amount = isPrepaidPayment ? "사용금액을 입력해주세요." : "금액을 입력해주세요.";
      } else if (!isAmountValid) {
        errors.amount = "0보다 큰 금액을 입력해주세요.";
      }
    }

    if (isPrepaidPayment) {
      if (!selectedPassId) {
        errors.prepaidPass = "사용할 정액권을 선택해주세요.";
      } else if (!errors.amount && selectedPass && discountedAmount <= 0) {
        errors.amount = "차감 금액이 0원 이하입니다. 시술가를 확인해주세요.";
      } else if (!errors.amount && selectedPass && discountedAmount > selectedPass.remainingBalance) {
        errors.amount = "정액권 잔액보다 많이 사용할 수 없습니다.";
      }
    } else if (isMembershipPayment) {
      if (!selectedMembershipPassId) {
        errors.membershipPass = "사용할 회원권을 선택해주세요.";
      } else if (selectedMembershipPass && selectedMembershipPass.remainingCount <= 0) {
        errors.membershipPass = "남은 횟수가 없는 회원권입니다.";
      }
    } else {
      if (!customerType) {
        errors.customerType = "고객 유형을 선택해주세요.";
      }
      if (!serviceType) {
        errors.serviceType = "시술 유형을 선택해주세요.";
      }
      if (!paymentChoice) {
        errors.paymentType = "결제수단을 선택해주세요.";
      }
    }

    return errors;
  }

  async function handleSave() {
    if (!settings) return;

    const errors = validateEntry();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors, ENTRY_FIELD_ORDER);
      return;
    }

    const now = new Date().toISOString();

    if (isMembershipPayment) {
      if (!selectedMembershipPass) return;
      try {
        const result = applyOwnMembershipUse(
          selectedMembershipPass,
          {
            id: crypto.randomUUID(),
            date,
            count: 1,
            memo: memo.trim() || undefined,
            createdAt: now,
          },
          settings
        );
        await recordMembershipLedgerResult(result);
        setMembershipPasses((prev) =>
          prev
            .map((p) => (p.id === result.pass.id ? result.pass : p))
            .filter((p) => p.status === "ACTIVE")
        );
        setMemo("");
        showSuccess("회원권 사용이 등록되었습니다.");
      } catch (e) {
        // 저장 실패 시에는 성공 오버레이를 보여주지 않고 화면에 오류만 남긴다.
        setFormError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      }
      return;
    }

    if (isPrepaidPayment) {
      if (!selectedPass) return;
      try {
        const result = applyOwnUse(
          selectedPass,
          {
            id: crypto.randomUUID(),
            date,
            creditAmount: discountedAmount,
            serviceAmount: hasDiscount ? amount : undefined,
            memo: memo.trim() || undefined,
            createdAt: now,
          },
          settings
        );
        await recordPrepaidLedgerResult(result);
        setPrepaidPasses((prev) =>
          prev
            .map((p) => (p.id === result.pass.id ? result.pass : p))
            .filter((p) => p.status === "ACTIVE")
        );
        setAmountText("");
        setMemo("");
        showSuccess("정액권 사용이 등록되었습니다.");
      } catch (e) {
        // 저장 실패 시에는 성공 오버레이를 보여주지 않고 화면에 오류만 남긴다.
        setFormError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      }
      return;
    }

    const transaction = buildTransactionSnapshot(
      {
        id: crypto.randomUUID(),
        date,
        amount,
        customerType,
        serviceType,
        paymentType: paymentChoice as PaymentType,
        memo: memo.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      },
      settings
    );

    try {
      await appendTransaction(transaction);
    } catch (e) {
      // 저장 실패 시에는 성공 오버레이를 보여주지 않고 화면에 오류만 남긴다.
      setFormError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      return;
    }

    setAmountText("");
    setMemo("");
    showSuccess("매출이 등록되었습니다.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">거래 등록</h1>
        <Link href="/prepaid" className="text-sm text-zinc-500 underline">
          보유 정액권 관리 →
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">날짜</span>
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

        {!isMembershipPayment && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">
              {isPrepaidPayment ? (hasDiscount ? "정상 시술가" : "사용금액") : "결제/시술 금액"}
            </span>
            <input
              ref={register("amount")}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={amountText}
              onChange={(e) => {
                setAmountText(normalizeAmountInput(e.target.value));
                setFieldErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              className={`rounded-xl border px-4 py-4 text-3xl font-bold tabular-nums ${fieldBorderClass(!!fieldErrors.amount)}`}
            />
            <FieldError message={fieldErrors.amount} />
            {hasDiscount && isAmountValid && (
              <p className="mt-1 text-xs text-zinc-500">
                정액권 할인 {Math.round(passDiscountRate * 100)}% → 실제 차감{" "}
                <span className="font-semibold text-zinc-900">{formatWon(discountedAmount)}</span>
              </p>
            )}
          </label>
        )}

        {!isPrepaidPayment && !isMembershipPayment && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-zinc-500">고객 유형</legend>
              <ChoiceGroup
                options={CUSTOMER_TYPES}
                value={customerType}
                onChange={(value) => {
                  setCustomerType(value);
                  setFieldErrors((prev) => ({ ...prev, customerType: undefined }));
                }}
                labels={CUSTOMER_TYPE_LABELS}
                containerRef={register("customerType")}
              />
              <FieldError message={fieldErrors.customerType} />
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-zinc-500">시술 유형</legend>
              <ChoiceGroup
                options={SERVICE_TYPES}
                value={serviceType}
                onChange={(value) => {
                  setServiceType(value);
                  setFieldErrors((prev) => ({ ...prev, serviceType: undefined }));
                }}
                labels={SERVICE_TYPE_LABELS}
                containerRef={register("serviceType")}
              />
              <FieldError message={fieldErrors.serviceType} />
            </fieldset>
          </>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-500">결제수단</legend>
          <ChoiceGroup
            options={PAYMENT_CHOICES}
            value={paymentChoice}
            onChange={(value) => {
              setPaymentChoice(value);
              setFieldErrors((prev) => ({
                ...prev,
                paymentType: undefined,
                prepaidPass: undefined,
                membershipPass: undefined,
                amount: undefined,
              }));
            }}
            labels={PAYMENT_CHOICE_LABELS}
            containerRef={register("paymentType")}
          />
          <FieldError message={fieldErrors.paymentType} />
        </fieldset>

        {isPrepaidPayment && (
          <div className="flex flex-col gap-3 rounded-xl border-l-4 border-zinc-900 bg-zinc-50 p-4">
            <p className="text-xs font-semibold text-zinc-500">
              정액권 결제 · 보유 중인 정액권의 잔액에서 차감됩니다
            </p>
            {prepaidPasses.length === 0 ? (
              <p className="text-sm text-zinc-500">
                사용 가능한 정액권이 없습니다.{" "}
                <Link href="/prepaid/new" className="underline">
                  정액권 등록하기
                </Link>
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-zinc-500">사용할 정액권</span>
                  <select
                    ref={register("prepaidPass")}
                    value={selectedPassId}
                    onChange={(e) => {
                      setSelectedPassId(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, prepaidPass: undefined }));
                    }}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.prepaidPass)}`}
                  >
                    <option value="">선택해주세요</option>
                    {prepaidPasses.map((pass) => (
                      <option key={pass.id} value={pass.id}>
                        {pass.label || `정액권 (${pass.purchaseDate})`} · 잔액{" "}
                        {formatWon(pass.remainingBalance)}
                      </option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.prepaidPass} />
                </label>

                {selectedPass && (
                  <p className="text-sm text-zinc-500">
                    현재 잔액{" "}
                    <span className="font-semibold text-zinc-900">
                      {formatWon(selectedPass.remainingBalance)}
                    </span>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {isMembershipPayment && (
          <div className="flex flex-col gap-3 rounded-xl border-l-4 border-zinc-900 bg-zinc-50 p-4">
            <p className="text-xs font-semibold text-zinc-500">
              회원권 결제 · 금액이 아니라 1회 사용 횟수가 차감됩니다
            </p>
            {membershipPasses.length === 0 ? (
              <p className="text-sm text-zinc-500">
                사용 가능한 회원권이 없습니다.{" "}
                <Link href="/membership/new" className="underline">
                  회원권 등록하기
                </Link>
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-zinc-500">사용할 회원권</span>
                  <select
                    ref={register("membershipPass")}
                    value={selectedMembershipPassId}
                    onChange={(e) => {
                      setSelectedMembershipPassId(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, membershipPass: undefined }));
                    }}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.membershipPass)}`}
                  >
                    <option value="">선택해주세요</option>
                    {membershipPasses.map((pass) => (
                      <option key={pass.id} value={pass.id}>
                        {pass.label} · 남은 {pass.remainingCount}/{pass.totalCount}회
                      </option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.membershipPass} />
                </label>

                {selectedMembershipPass && (
                  <p className="text-sm text-zinc-500">
                    남은 횟수{" "}
                    <span className="font-semibold text-zinc-900">
                      {selectedMembershipPass.remainingCount}회
                    </span>{" "}
                    · 1회 사용으로 차감됩니다
                  </p>
                )}
              </>
            )}
          </div>
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

        {transactionPreview && (
          <div className="rounded-xl bg-zinc-50 p-4 text-sm">
            <p className="flex justify-between">
              <span className="text-zinc-500">정산 기준금액</span>
              <span>{formatWon(transactionPreview.settlementBaseAmount)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-zinc-500">
                적용 인센티브율 ({Math.round(transactionPreview.commissionRate * 100)}%)
              </span>
              <span>{formatWon(transactionPreview.settlementAmount)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between border-t border-zinc-200 pt-1">
              <span className="font-semibold">예상 정산액</span>
              <span className="text-lg font-bold">
                {formatWon(transactionPreview.settlementAmount)}
              </span>
            </p>
            {transactionPreview.withholding3_3Applied && (
              <p className="flex justify-between text-zinc-500">
                <span>예상 지급액 (3.3% 반영)</span>
                <span>{formatWon(transactionPreview.estimatedPayoutAmount)}</span>
              </p>
            )}
          </div>
        )}

        {prepaidUsePreview && (
          <div className="rounded-xl bg-zinc-50 p-4 text-sm">
            <p className="flex justify-between">
              <span className="text-zinc-500">정산 반영 매출</span>
              <span>{formatSignedWon(prepaidUsePreview.event.salesImpact)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between">
              <span className="font-semibold">정산 영향</span>
              <span className="text-lg font-bold">
                {formatSignedWon(prepaidUsePreview.event.settlementImpact)}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              사용 후 잔액 {formatWon(prepaidUsePreview.pass.remainingBalance)}
            </p>
          </div>
        )}

        {membershipUsePreview && (
          <div className="rounded-xl bg-zinc-50 p-4 text-sm">
            <p className="flex justify-between">
              <span className="text-zinc-500">정산 반영 매출</span>
              <span>{formatSignedWon(membershipUsePreview.event.salesImpact)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between">
              <span className="font-semibold">정산 영향</span>
              <span className="text-lg font-bold">
                {formatSignedWon(membershipUsePreview.event.settlementImpact)}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              사용 후 남은 횟수 {membershipUsePreview.pass.remainingCount}회
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="mt-2 min-h-[52px] rounded-xl bg-zinc-900 py-4 text-center text-base font-semibold text-white"
        >
          저장
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
