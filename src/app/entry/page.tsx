"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildTransactionSnapshot, calculateSettlement } from "@/lib/settlement/engine";
import { purchasePrepaidPass } from "@/lib/settlement/prepaid";
import {
  BONUS_SETTLEMENT_MODES,
  BONUS_SETTLEMENT_MODE_LABELS,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  PREPAID_RECOGNITION_MODES,
  PREPAID_RECOGNITION_MODE_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon, todayDateString } from "@/lib/settlement/format";
import {
  appendTransaction,
  loadSettlementSettings,
  recordPrepaidLedgerResult,
} from "@/lib/settlement/storage";
import type {
  BonusSettlementMode,
  CustomerType,
  PaymentType,
  PrepaidRecognitionMode,
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

type EntryMode = "TRANSACTION" | "PREPAID";

export default function EntryPage() {
  const [mode, setMode] = useState<EntryMode>("TRANSACTION");
  const [settings, setSettings] = useState<SettlementSettings | null>(null);

  useEffect(() => {
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettlementSettings());
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">거래 등록</h1>
        <Link href="/prepaid" className="text-sm text-zinc-500 underline">
          보유 정액권 관리 →
        </Link>
      </div>

      <div className="flex gap-2 rounded-full bg-zinc-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("TRANSACTION")}
          className={`flex-1 rounded-full py-1.5 ${
            mode === "TRANSACTION" ? "bg-white font-semibold shadow-sm" : "text-zinc-500"
          }`}
        >
          일반 매출
        </button>
        <button
          type="button"
          onClick={() => setMode("PREPAID")}
          className={`flex-1 rounded-full py-1.5 ${
            mode === "PREPAID" ? "bg-white font-semibold shadow-sm" : "text-zinc-500"
          }`}
        >
          정액권 판매
        </button>
      </div>

      {mode === "TRANSACTION" ? (
        <TransactionForm settings={settings} />
      ) : (
        <PrepaidSaleForm settings={settings} />
      )}
    </div>
  );
}

function TransactionForm({ settings }: { settings: SettlementSettings | null }) {
  const [date, setDate] = useState(todayDateString());
  const [amountText, setAmountText] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("OTHER");
  const [serviceType, setServiceType] = useState<ServiceType>("CUT");
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
  );
}

function PrepaidSaleForm({ settings }: { settings: SettlementSettings | null }) {
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
  const [message, setMessage] = useState<string | null>(null);

  const paidAmount = Number(paidAmountText);
  const creditAmount = Number(creditAmountText);
  const isValid =
    Number.isFinite(paidAmount) && paidAmount > 0 && Number.isFinite(creditAmount) && creditAmount > 0;

  function handlePaidAmountChange(value: string) {
    setPaidAmountText(value);
    if (!creditTouched) setCreditAmountText(value);
    setMessage(null);
  }

  function handleCreditAmountChange(value: string) {
    setCreditAmountText(value);
    setCreditTouched(true);
    setMessage(null);
  }

  function handleSave() {
    if (!settings) return;
    if (!isValid) {
      setMessage("실결제금액과 사용가능금액을 입력해주세요.");
      return;
    }

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

    recordPrepaidLedgerResult(result);
    setMessage(
      `판매 완료 · 매출 반영 ${formatWon(result.event.salesImpact)} · 정산 반영 ${formatWon(
        result.event.settlementImpact
      )}`
    );
    setLabel("");
    setPaidAmountText("");
    setCreditAmountText("");
    setCreditTouched(false);
    setMemo("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">판매일</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">정액권 식별명 (선택)</span>
        <input
          type="text"
          placeholder="예: OO고객 100만원권"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">실결제금액</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={paidAmountText}
          onChange={(e) => handlePaidAmountChange(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-3 text-2xl font-semibold"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">사용가능금액 (보너스 포함, 기본값은 실결제금액과 동일)</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={creditAmountText}
          onChange={(e) => handleCreditAmountChange(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2"
        />
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
        className="mt-2 rounded-xl bg-zinc-900 py-3 text-center font-semibold text-white"
      >
        판매 저장
      </button>

      {message && <p className="text-center text-sm text-zinc-500">{message}</p>}
    </div>
  );
}
