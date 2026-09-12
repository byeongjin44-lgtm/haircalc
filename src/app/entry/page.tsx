"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildTransactionSnapshot, calculateSettlement } from "@/lib/settlement/engine";
import { useOwnPrepaidCredit as applyOwnUse } from "@/lib/settlement/prepaid";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from "@/lib/settlement/labels";
import { formatSignedWon, formatWon, todayDateString } from "@/lib/settlement/format";
import {
  appendTransaction,
  loadPrepaidPasses,
  loadSettlementSettings,
  recordPrepaidLedgerResult,
} from "@/lib/settlement/storage";
import type {
  CustomerType,
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
          className={`rounded-full border px-3 py-1.5 text-sm ${
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
type PaymentChoice = PaymentType | "PREPAID";

const PAYMENT_CHOICES: readonly PaymentChoice[] = [...PAYMENT_TYPES, "PREPAID"];

const PAYMENT_CHOICE_LABELS: Record<PaymentChoice, string> = {
  ...PAYMENT_TYPE_LABELS,
  PREPAID: "정액권",
};

export default function EntryPage() {
  const [settings, setSettings] = useState<SettlementSettings | null>(null);
  const [prepaidPasses, setPrepaidPasses] = useState<PrepaidPass[]>([]);

  const [date, setDate] = useState(todayDateString());
  const [amountText, setAmountText] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("OTHER");
  const [serviceType, setServiceType] = useState<ServiceType>("CUT");
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("CASH");
  const [selectedPassId, setSelectedPassId] = useState("");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadedSettings = loadSettlementSettings();
    const loadedPasses = loadPrepaidPasses().filter((p) => p.status === "ACTIVE");
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadedSettings);
    setPrepaidPasses(loadedPasses);
  }, []);

  const isPrepaidPayment = paymentChoice === "PREPAID";
  const selectedPass = prepaidPasses.find((p) => p.id === selectedPassId) ?? null;

  const amount = Number(amountText);
  const isAmountValid = Number.isFinite(amount) && amount > 0;

  const transactionPreview = useMemo(() => {
    if (!settings || isPrepaidPayment || !isAmountValid) return null;
    return calculateSettlement(amount, customerType, paymentChoice as PaymentType, settings);
  }, [settings, isPrepaidPayment, isAmountValid, amount, customerType, paymentChoice]);

  function computePrepaidUsePreview() {
    if (!settings || !isPrepaidPayment || !selectedPass || !isAmountValid) return null;
    try {
      return applyOwnUse(
        selectedPass,
        { id: "preview", date, creditAmount: amount, createdAt: new Date().toISOString() },
        settings
      );
    } catch {
      return null;
    }
  }
  const prepaidUsePreview = computePrepaidUsePreview();

  function handleSave() {
    if (!settings) return;
    if (!isAmountValid) {
      setMessage("금액을 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();

    if (isPrepaidPayment) {
      if (!selectedPass) {
        setMessage("사용할 정액권을 선택해주세요.");
        return;
      }
      try {
        const result = applyOwnUse(
          selectedPass,
          {
            id: crypto.randomUUID(),
            date,
            creditAmount: amount,
            memo: memo.trim() || undefined,
            createdAt: now,
          },
          settings
        );
        recordPrepaidLedgerResult(result);
        setPrepaidPasses((prev) =>
          prev
            .map((p) => (p.id === result.pass.id ? result.pass : p))
            .filter((p) => p.status === "ACTIVE")
        );
        setMessage(
          `정액권 사용 완료 · 매출 ${formatSignedWon(result.event.salesImpact)} · 정산 ${formatSignedWon(
            result.event.settlementImpact
          )}`
        );
        setAmountText("");
        setMemo("");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "저장에 실패했습니다.");
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

    appendTransaction(transaction);
    setMessage(`저장 완료 · 예상 정산액 ${formatWon(transaction.settlementAmount)}`);
    setAmountText("");
    setMemo("");
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
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">
            {isPrepaidPayment ? "사용금액" : "결제/시술 금액"}
          </span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value);
              setMessage(null);
            }}
            className="rounded-lg border border-zinc-200 px-3 py-3 text-2xl font-semibold"
          />
        </label>

        {!isPrepaidPayment && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-zinc-500">고객 유형</legend>
              <ChoiceGroup
                options={CUSTOMER_TYPES}
                value={customerType}
                onChange={setCustomerType}
                labels={CUSTOMER_TYPE_LABELS}
              />
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-zinc-500">시술 유형</legend>
              <ChoiceGroup
                options={SERVICE_TYPES}
                value={serviceType}
                onChange={setServiceType}
                labels={SERVICE_TYPE_LABELS}
              />
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
              setMessage(null);
            }}
            labels={PAYMENT_CHOICE_LABELS}
          />
        </fieldset>

        {isPrepaidPayment && (
          <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-4">
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
                  <span className="text-sm text-zinc-500">보유 정액권 선택</span>
                  <select
                    value={selectedPassId}
                    onChange={(e) => setSelectedPassId(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2"
                  >
                    <option value="">선택해주세요</option>
                    {prepaidPasses.map((pass) => (
                      <option key={pass.id} value={pass.id}>
                        {pass.label || `정액권 (${pass.purchaseDate})`} · 잔액{" "}
                        {formatWon(pass.remainingBalance)}
                      </option>
                    ))}
                  </select>
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
            <p className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-semibold">
              <span>예상 정산액</span>
              <span>{formatWon(transactionPreview.settlementAmount)}</span>
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
            <p className="mt-1 flex justify-between font-semibold">
              <span>정산 영향</span>
              <span>{formatSignedWon(prepaidUsePreview.event.settlementImpact)}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              사용 후 잔액 {formatWon(prepaidUsePreview.pass.remainingBalance)}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="mt-2 rounded-xl bg-zinc-900 py-3 text-center font-semibold text-white"
        >
          저장
        </button>

        {message && <p className="text-center text-sm text-zinc-500">{message}</p>}
      </div>
    </div>
  );
}
