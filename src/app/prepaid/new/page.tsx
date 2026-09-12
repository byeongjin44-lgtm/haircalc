"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { purchasePrepaidPass } from "@/lib/settlement/prepaid";
import {
  BONUS_SETTLEMENT_MODES,
  BONUS_SETTLEMENT_MODE_LABELS,
  PREPAID_RECOGNITION_MODES,
  PREPAID_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon, todayDateString } from "@/lib/settlement/format";
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

export default function PrepaidNewPage() {
  const [settings, setSettings] = useState<SettlementSettings | null>(null);

  useEffect(() => {
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettlementSettings());
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
  const [message, setMessage] = useState<string | null>(null);

  const paidAmount = Number(paidAmountText);
  const creditAmount = Number(creditAmountText);
  const isValid =
    Number.isFinite(paidAmount) &&
    paidAmount > 0 &&
    Number.isFinite(creditAmount) &&
    creditAmount > 0;

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
      `등록 완료 · 매출 반영 ${formatWon(result.event.salesImpact)} · 정산 반영 ${formatWon(
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
          <span className="text-sm text-zinc-500">
            사용가능금액 (보너스 포함, 기본값은 실결제금액과 동일)
          </span>
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
          등록 저장
        </button>

        {message && <p className="text-center text-sm text-zinc-500">{message}</p>}
      </div>
    </div>
  );
}
