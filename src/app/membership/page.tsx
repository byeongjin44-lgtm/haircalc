"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassesTabs from "@/components/PassesTabs";
import { FieldError, fieldBorderClass } from "@/components/FieldError";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import {
  MEMBERSHIP_PASS_STATUS_LABELS,
  MEMBERSHIP_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatWon, todayDateString } from "@/lib/settlement/format";
import {
  useByOtherDesigner as applyOtherDesignerUse,
  type MembershipLedgerResult,
} from "@/lib/settlement/membership";
import {
  loadMembershipPasses,
  loadSettlementSettings,
  recordMembershipLedgerResult,
} from "@/lib/settlement/storage";
import type { MembershipPass, SettlementSettings } from "@/lib/settlement/types";

export default function MembershipListPage() {
  const { showSuccess } = useSuccessOverlay();
  const [passes, setPasses] = useState<MembershipPass[] | null>(null);
  const [settings, setSettings] = useState<SettlementSettings | null>(null);
  const [otherDesignerUseTarget, setOtherDesignerUseTarget] = useState<MembershipPass | null>(
    null
  );

  useEffect(() => {
    (async () => {
      const [loaded, loadedSettings] = await Promise.all([
        loadMembershipPasses(),
        loadSettlementSettings(),
      ]);
      const sorted = [...loaded].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setPasses(sorted);
      setSettings(loadedSettings);
    })();
  }, []);

  function handleOtherDesignerUseSaved(result: MembershipLedgerResult) {
    setPasses((prev) => prev?.map((p) => (p.id === result.pass.id ? result.pass : p)) ?? prev);
    setOtherDesignerUseTarget(null);
    showSuccess("타 디자이너 사용이 반영되었습니다.");
  }

  return (
    <div className="flex flex-col gap-4">
      <PassesTabs active="membership" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">회원권</h1>
        <Link
          href="/membership/new"
          className="min-h-[36px] rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white"
        >
          + 회원권 등록
        </Link>
      </div>

      <p className="text-xs text-zinc-400">
        남은 횟수는 이 앱에 기록한 내역 기준입니다. 다른 디자이너가 사용한 경우 직접
        반영해주세요.
      </p>

      {!passes && <p className="text-sm text-zinc-400">불러오는 중...</p>}

      {passes && passes.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-400">등록된 회원권이 없습니다.</p>
          <Link
            href="/membership/new"
            className="min-h-[48px] rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
          >
            첫 회원권 등록
          </Link>
        </div>
      )}

      {passes && passes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passes.map((pass) => {
            const isEnded = pass.status !== "ACTIVE";

            return (
              <li
                key={pass.id}
                className={`rounded-2xl shadow-sm ${isEnded ? "bg-zinc-100" : "bg-white"}`}
              >
                <Link href={`/membership/${pass.id}`} className="block p-4">
                  <div className="flex items-center justify-between gap-2">
                    {/* 금액보다 남은 횟수를 더 눈에 띄게 보여준다. */}
                    <span
                      className={`text-xl font-bold tabular-nums ${
                        isEnded ? "text-zinc-400" : "text-zinc-900"
                      }`}
                    >
                      {pass.remainingCount} / {pass.totalCount}회 남음
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        isEnded ? "bg-zinc-200 text-zinc-500" : "bg-zinc-900 text-white"
                      }`}
                    >
                      {MEMBERSHIP_PASS_STATUS_LABELS[pass.status]}
                    </span>
                  </div>
                  <div
                    className={`mt-1 truncate text-sm font-medium ${
                      isEnded ? "text-zinc-400" : "text-zinc-700"
                    }`}
                  >
                    {pass.label}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    실결제 {formatWon(pass.paidAmount)} ·{" "}
                    {MEMBERSHIP_RECOGNITION_MODE_LABELS[pass.recognitionMode]}
                  </div>
                </Link>
                {!isEnded && (
                  <div className="border-t border-zinc-100 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setOtherDesignerUseTarget(pass)}
                      className="min-h-[36px] w-full rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600"
                    >
                      타 디자이너 사용
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {otherDesignerUseTarget && settings && (
        <QuickOtherDesignerUseModal
          pass={otherDesignerUseTarget}
          settings={settings}
          onClose={() => setOtherDesignerUseTarget(null)}
          onSaved={handleOtherDesignerUseSaved}
        />
      )}
    </div>
  );
}

/**
 * 목록에서 바로 "타 디자이너 사용"(1회 차감)을 기록하는 빠른 입력 모달. 상세 화면까지
 * 이동하지 않고 최소 탭으로 기록할 수 있게 한다. 계산은 기존
 * useByOtherDesigner(membership.ts)를 그대로 재사용한다 — 새 계산식을 만들지 않는다.
 */
function QuickOtherDesignerUseModal({
  pass,
  settings,
  onClose,
  onSaved,
}: {
  pass: MembershipPass;
  settings: SettlementSettings;
  onClose: () => void;
  onSaved: (result: MembershipLedgerResult) => void;
}) {
  const [date, setDate] = useState(todayDateString());
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | undefined>(undefined);

  function handleSubmit() {
    if (!date.trim()) {
      setDateError("날짜를 입력해주세요.");
      return;
    }
    setDateError(undefined);
    setError(null);

    try {
      const result = applyOtherDesignerUse(
        pass,
        { id: crypto.randomUUID(), date, count: 1, createdAt: new Date().toISOString() },
        settings
      );
      recordMembershipLedgerResult(result)
        .then(() => onSaved(result))
        .catch((e) => setError(e instanceof Error ? e.message : "저장에 실패했습니다."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  }

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-[340px] flex-col gap-3 rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-zinc-900">타 디자이너 사용 (1회)</p>
        <p className="text-xs text-zinc-500">
          {pass.label} · 남은 {pass.remainingCount}회
        </p>
        <p className="text-xs text-zinc-400">
          다른 디자이너의 급여를 계산하는 기능이 아닙니다. 내가 관리 중인 이 회원권을
          다른 디자이너가 사용했을 때, 내 남은 횟수와 정산 영향만 반영합니다.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">날짜</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setDateError(undefined);
            }}
            className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!dateError)}`}
          />
          <FieldError message={dateError} />
        </label>

        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pass.remainingCount <= 0}
            className="min-h-[48px] flex-1 rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-40"
          >
            1회 사용 확정
          </button>
        </div>
      </div>
    </div>
  );
}
