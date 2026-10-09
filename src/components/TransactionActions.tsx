"use client";
import { useRef, useState } from "react";
import { useSuccessOverlay } from "./SuccessOverlay";
import { FieldError, fieldBorderClass } from "./FieldError";
import { useFieldRefs } from "./useFieldRefs";
import { deleteTransaction, loadSettlementSettings, updateTransaction } from "@/lib/settlement/storage";
import { editTransaction, transactionPayout, type TransactionEdit } from "@/lib/settlement/transaction";
import { VAT_MODE_LABELS, MATERIAL_COST_MODE_LABELS, CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, SERVICE_TYPES, SERVICE_TYPE_LABELS, PAYMENT_TYPES, PAYMENT_TYPE_LABELS } from "@/lib/settlement/labels";
import { formatWon, normalizeAmountInput } from "@/lib/settlement/format";
import type { Transaction, SettlementSettings } from "@/lib/settlement/types";

export default function TransactionActions({ transaction, onChanged }: { transaction: Transaction; onChanged: (tx: Transaction | null) => void }) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [form, setForm] = useState<TransactionEdit>(transaction);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [rules, setRules] = useState<SettlementSettings | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<{ date?: string; amount?: string }>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const { register, focusFirstError } = useFieldRefs<"date" | "amount">();
  const { showSuccess } = useSuccessOverlay();
  const input = { ...form, amount: Number(amount) };
  const changedCalculation = input.amount !== transaction.amount || input.customerType !== transaction.customerType || input.paymentType !== transaction.paymentType;
  const needsConfirmation = !transaction.settlementSettingsSnapshot && changedCalculation;
  let preview: Transaction | null = null;
  try { preview = editTransaction(transaction, input, transaction.updatedAt, confirmed && rules ? rules : undefined); } catch {}

  async function openEdit() {
    setForm(transaction); setAmount(String(transaction.amount)); setConfirmed(false); setError(""); setErrors({});
    setMode("edit");
    try { setRules(await loadSettlementSettings()); } catch { setError("정산 설정을 불러오지 못했습니다."); }
  }
  async function save() {
    if (saving.current) return;
    const nextErrors: typeof errors = {};
    if (!form.date) nextErrors.date = "날짜를 입력해주세요.";
    if (!amount.trim() || !Number.isFinite(input.amount) || input.amount <= 0) nextErrors.amount = "0보다 큰 금액을 입력해주세요.";
    setErrors(nextErrors); setError("");
    if (Object.keys(nextErrors).length) { focusFirstError(nextErrors, ["date", "amount"]); return; }
    if (needsConfirmation && (!confirmed || !rules)) { setError("재계산에 사용할 설정을 확인해주세요."); return; }
    saving.current = true; setBusy(true);
    try {
      const updated = await updateTransaction(transaction.id, input, confirmed && rules ? rules : undefined);
      onChanged(updated); setMode(null); showSuccess("거래가 수정되었습니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "저장에 실패했습니다."); }
    finally { saving.current = false; setBusy(false); }
  }
  async function remove() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      await deleteTransaction(transaction.id);
      onChanged(null); setMode(null); showSuccess("거래가 삭제되었습니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "삭제에 실패했습니다."); }
    finally { saving.current = false; setBusy(false); }
  }
  const control = "min-h-[48px] w-full rounded-lg border px-3 py-2";
  return <>
    <div className="mt-3 flex gap-4">
      <button type="button" onClick={openEdit} className="min-h-[48px] flex-1 rounded-xl border border-zinc-200 px-4 text-sm">수정</button>
      <button type="button" onClick={() => { setError(""); setMode("delete"); }} className="min-h-[48px] flex-1 rounded-xl border border-red-300 px-4 text-sm text-red-600">삭제</button>
    </div>
    {mode && <div role="dialog" aria-modal="true" aria-label={mode === "edit" ? "거래 수정" : "거래 삭제"} className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">{mode === "edit" ? "거래 수정" : "이 거래를 삭제할까요?"}</h2>
        {mode === "delete" ? <p className="text-sm text-zinc-600">삭제하면 해당 거래가 월정산에서도 제외됩니다.</p> : <>
          <label>날짜<input autoFocus ref={register("date")} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={control + " " + fieldBorderClass(!!errors.date)} /><FieldError message={errors.date} /></label>
          <label>금액<input ref={register("amount")} type="text" inputMode="numeric" value={amount} onChange={e => setAmount(normalizeAmountInput(e.target.value))} className={control + " " + fieldBorderClass(!!errors.amount)} /><FieldError message={errors.amount} /></label>
          <label>고객 유형<select value={form.customerType} onChange={e => setForm({ ...form, customerType: e.target.value as Transaction["customerType"] })} className={control}>{CUSTOMER_TYPES.map(v => <option key={v} value={v}>{CUSTOMER_TYPE_LABELS[v]}</option>)}</select></label>
          <label>시술 유형<select value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value as Transaction["serviceType"] })} className={control}>{SERVICE_TYPES.map(v => <option key={v} value={v}>{SERVICE_TYPE_LABELS[v]}</option>)}</select></label>
          <label>결제수단<select value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value as Transaction["paymentType"] })} className={control}>{PAYMENT_TYPES.map(v => <option key={v} value={v}>{PAYMENT_TYPE_LABELS[v]}</option>)}</select></label>
          <label>메모<input value={form.memo ?? ""} onChange={e => setForm({ ...form, memo: e.target.value })} className={control} /></label>
          {transaction.settlementSettingsSnapshot ? <p className="text-xs text-zinc-500">등록 당시 정산 규칙으로 다시 계산합니다.</p> : <div className="rounded-xl bg-amber-50 p-3 text-sm">
            <p>이 거래에는 당시 정산 규칙 전체가 저장되어 있지 않습니다. 날짜·시술·메모는 기존 정산 결과를 유지합니다. 금액·고객 유형·결제수단 변경에는 사용할 설정 확인이 필요합니다.</p>
            {rules && <><p className="mt-2">현재 설정: 기본 {rules.baseIncentiveRate * 100}% · 3.3% {rules.withholding3_3 ? "ON" : "OFF"} · 재료비 {MATERIAL_COST_MODE_LABELS[rules.materialCost.mode]} {rules.materialCost.mode === "PERCENT" ? rules.materialCost.value * 100 + "%" : rules.materialCost.mode === "FIXED" ? formatWon(rules.materialCost.value) : ""} · 카드수수료 {rules.cardFee.enabled ? rules.cardFee.rate * 100 : 0}% · VAT {VAT_MODE_LABELS[rules.vatMode]}</p>
              <p className="mt-1">고객별 요율: {Object.entries(rules.customerTypeRates).map(([key, rate]) => CUSTOMER_TYPE_LABELS[key as Transaction["customerType"]] + " " + Number(rate) * 100 + "%").join(", ") || "기본 요율 적용"}</p>
              <label className="mt-2 flex min-h-[48px] items-center gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />위 현재 설정으로 이 거래를 재계산하는 데 동의합니다.</label></>}
          </div>}
          {preview && <p className="font-semibold">예상 지급액 {formatWon(transactionPayout(preview))}</p>}
        </>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-4">
          <button type="button" disabled={busy} onClick={() => setMode(null)} className="min-h-[48px] flex-1 rounded-xl bg-zinc-100">취소</button>
          <button type="button" disabled={busy} onClick={mode === "edit" ? save : remove} className={"min-h-[48px] flex-1 rounded-xl text-white disabled:opacity-50 " + (mode === "edit" ? "bg-zinc-900" : "bg-red-600")}>{busy ? "처리 중..." : mode === "edit" ? "저장" : "삭제"}</button>
        </div>
      </div>
    </div>}
  </>;
}
