"use client";

import { useRef, useState } from "react";
import { useSuccessOverlay } from "./SuccessOverlay";
import { deleteTransaction } from "@/lib/settlement/storage";
import type { Transaction } from "@/lib/settlement/types";

export default function TransactionActions({ transaction, onDeleted }: {
  transaction: Transaction;
  onDeleted: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const { showSuccess } = useSuccessOverlay();

  async function remove() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      await deleteTransaction(transaction.id);
      onDeleted(); setShowDeleteConfirm(false); showSuccess("거래가 삭제되었습니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "삭제에 실패했습니다."); }
    finally { saving.current = false; setBusy(false); }
  }

  return <>
    <div className="mt-3 flex gap-4">
      <button type="button" onClick={() => { setError(""); setShowDeleteConfirm(true); }} className="min-h-[48px] flex-1 rounded-xl border border-red-300 px-4 text-sm text-red-600">삭제</button>
    </div>
    {showDeleteConfirm && <div role="dialog" aria-modal="true" aria-label="거래 삭제" className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">이 거래를 삭제할까요?</h2>
        <p className="text-sm text-zinc-600">삭제하면 해당 거래가 월정산에서도 제외됩니다.</p>
        <p className="text-sm text-zinc-600">잘못 등록한 거래는 삭제 후 다시 등록해주세요.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-4">
          <button type="button" disabled={busy} onClick={() => setShowDeleteConfirm(false)} className="min-h-[48px] flex-1 rounded-xl bg-zinc-100">취소</button>
          <button type="button" disabled={busy} onClick={remove} className="min-h-[48px] flex-1 rounded-xl bg-red-600 text-white disabled:opacity-50">{busy ? "처리 중..." : "삭제"}</button>
        </div>
      </div>
    </div>}
  </>;
}
