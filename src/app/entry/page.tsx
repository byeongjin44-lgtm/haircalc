"use client";

import { useEffect, useMemo, useState } from "react";
import { buildTransactionSnapshot, calculateSettlement } from "@/lib/settlement/engine";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon, todayDateString } from "@/lib/settlement/format";
import { appendTransaction, loadSettlementSettings } from "@/lib/settlement/storage";
import type {
  CustomerType,
  PaymentType,
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

export default function EntryPage() {
  const [settings, setSettings] = useState<SettlementSettings | null>(null);
  const [date, setDate] = useState(todayDateString());
  const [amountText, setAmountText] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("OTHER");
  const [serviceType, setServiceType] = useState<ServiceType>("CUT");
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettlementSettings());
  }, []);

  const amount = Number(amountText);
  const isAmountValid = Number.isFinite(amount) && amount > 0;

  const preview = useMemo(() => {
    if (!settings || !isAmountValid) return null;
    return calculateSettlement(amount, customerType, paymentType, settings);
  }, [settings, isAmountValid, amount, customerType, paymentType]);

  function handleSave() {
    if (!settings) return;
    if (!isAmountValid) {
      setMessage("금액을 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();
    const transaction = buildTransactionSnapshot(
      {
        id: crypto.randomUUID(),
        date,
        amount,
        customerType,
        serviceType,
        paymentType,
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
      <h1 className="text-xl font-bold">거래 등록</h1>

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
          <span className="text-sm text-zinc-500">결제/시술 금액</span>
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

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-500">결제수단</legend>
          <ChoiceGroup
            options={PAYMENT_TYPES}
            value={paymentType}
            onChange={setPaymentType}
            labels={PAYMENT_TYPE_LABELS}
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

        {preview && (
          <div className="rounded-xl bg-zinc-50 p-4 text-sm">
            <p className="flex justify-between">
              <span className="text-zinc-500">정산 기준금액</span>
              <span>{formatWon(preview.settlementBaseAmount)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-zinc-500">
                적용 인센티브율 ({Math.round(preview.commissionRate * 100)}%)
              </span>
              <span>{formatWon(preview.settlementAmount)}</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-semibold">
              <span>예상 정산액</span>
              <span>{formatWon(preview.settlementAmount)}</span>
            </p>
            {preview.withholding3_3Applied && (
              <p className="flex justify-between text-zinc-500">
                <span>예상 지급액 (3.3% 반영)</span>
                <span>{formatWon(preview.estimatedPayoutAmount)}</span>
              </p>
            )}
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
