"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FieldError, fieldBorderClass } from "@/components/FieldError";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import {
  MEMBERSHIP_EVENT_TYPE_LABELS,
  MEMBERSHIP_PASS_STATUS_LABELS,
  MEMBERSHIP_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatSignedWon, formatWon, todayDateString } from "@/lib/settlement/format";
import {
  adjustMembershipPass,
  calculatePerUseAmount,
  useByOtherDesigner as applyOtherDesignerUse,
  useOwnMembershipCount as applyOwnUse,
  type MembershipLedgerResult,
  type MembershipUseInput,
} from "@/lib/settlement/membership";
import {
  deleteMembershipPass,
  loadMembershipEvents,
  loadMembershipPasses,
  loadSettlementSettings,
  recordMembershipLedgerResult,
} from "@/lib/settlement/storage";
import type { MembershipEvent, MembershipPass, SettlementSettings } from "@/lib/settlement/types";

type ActionType = "USE" | "OTHER_DESIGNER_USE" | "ADJUSTMENT";

const ACTION_LABELS: Record<ActionType, string> = {
  USE: "1회 사용",
  OTHER_DESIGNER_USE: "타 디자이너 사용",
  ADJUSTMENT: "횟수 조정",
};

/** 조정은 잔여 횟수/매출을 직접 바꾸는 위험도가 높은 동작이라 다른 색으로 구분한다. */
const RISKY_ACTIONS: readonly ActionType[] = ["ADJUSTMENT"];

const ACTION_SUCCESS_MESSAGES: Record<ActionType, string> = {
  USE: "회원권 1회 사용이 등록되었습니다.",
  OTHER_DESIGNER_USE: "타 디자이너 사용이 반영되었습니다.",
  ADJUSTMENT: "조정이 반영되었습니다.",
};

export default function MembershipDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const passId = params.id;
  const { showSuccess } = useSuccessOverlay();

  const [settings, setSettings] = useState<SettlementSettings | null>(null);
  const [pass, setPass] = useState<MembershipPass | null | undefined>(undefined);
  const [events, setEvents] = useState<MembershipEvent[]>([]);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [loadedSettings, loadedPasses, loadedAllEvents] = await Promise.all([
        loadSettlementSettings(),
        loadMembershipPasses(),
        loadMembershipEvents(),
      ]);
      const loadedPass = loadedPasses.find((p) => p.id === passId) ?? null;
      const loadedEvents = loadedAllEvents
        .filter((e) => e.membershipPassId === passId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setSettings(loadedSettings);
      setPass(loadedPass);
      setEvents(loadedEvents);
    })();
  }, [passId]);

  async function handleSaved(result: MembershipLedgerResult, action: ActionType) {
    try {
      await recordMembershipLedgerResult(result);
    } catch (e) {
      // 저장 실패 시에는 성공 토스트를 보여주지 않고 화면에 오류만 남긴다.
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      return;
    }

    setError(null);
    setPass(result.pass);
    setEvents((prev) => [result.event, ...prev]);
    setActiveAction(null);
    showSuccess(ACTION_SUCCESS_MESSAGES[action]);
  }

  async function handleDeleteConfirmed() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteMembershipPass(passId);
    } catch (e) {
      // 삭제 실패 시에는 성공 오버레이/이동 없이 화면에 오류만 남긴다.
      setDeleteError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      setIsDeleting(false);
      return;
    }

    setShowDeleteConfirm(false);
    showSuccess("회원권이 삭제되었습니다.");
    router.push("/membership");
  }

  if (pass === undefined || !settings) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  if (pass === null) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/membership" className="text-sm text-zinc-500">
          ← 회원권 목록으로
        </Link>
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
          회원권을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const isActive = pass.status === "ACTIVE";
  const perUseAmount = calculatePerUseAmount(pass.paidAmount, pass.totalCount);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/membership" className="text-sm text-zinc-500">
        ← 회원권 목록으로
      </Link>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{pass.label}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              isActive ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
            }`}
          >
            {MEMBERSHIP_PASS_STATUS_LABELS[pass.status]}
          </span>
        </div>

        <div className="mt-3">
          {/* 금액보다 남은 횟수를 더 눈에 띄게 한다. */}
          <p className="text-xs text-zinc-500">남은 횟수</p>
          <p className="text-3xl font-bold tabular-nums">
            {pass.remainingCount}
            <span className="text-base font-medium text-zinc-400"> / {pass.totalCount}회</span>
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500">실결제금액</p>
            <p className="font-semibold">{formatWon(pass.paidAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">1회 기준 매출</p>
            <p className="font-semibold">{formatWon(perUseAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">정산 반영 방식</p>
            <p className="font-semibold">
              {MEMBERSHIP_RECOGNITION_MODE_LABELS[pass.recognitionMode]}
            </p>
          </div>
        </div>
        {pass.memo && <p className="mt-3 text-xs text-zinc-400">{pass.memo}</p>}
      </section>

      {isActive && (
        <section className="grid grid-cols-3 gap-2">
          {(Object.keys(ACTION_LABELS) as ActionType[]).map((action) => {
            const isRisky = RISKY_ACTIONS.includes(action);
            const isSelected = activeAction === action;

            return (
              <button
                key={action}
                type="button"
                onClick={() => setActiveAction((prev) => (prev === action ? null : action))}
                className={`min-h-[44px] rounded-xl py-2 text-xs font-semibold ${
                  isSelected
                    ? isRisky
                      ? "bg-red-600 text-white"
                      : "bg-zinc-900 text-white"
                    : isRisky
                      ? "border border-red-200 bg-white text-red-600"
                      : "bg-white text-zinc-700 shadow-sm"
                }`}
              >
                {ACTION_LABELS[action]}
              </button>
            );
          })}
        </section>
      )}

      {activeAction === "USE" && (
        <CountEventForm
          pass={pass}
          perUseAmount={perUseAmount}
          compute={(input) => applyOwnUse(pass, input, settings)}
          onSaved={(result) => handleSaved(result, "USE")}
        />
      )}
      {activeAction === "OTHER_DESIGNER_USE" && (
        <CountEventForm
          pass={pass}
          perUseAmount={perUseAmount}
          compute={(input) => applyOtherDesignerUse(pass, input, settings)}
          onSaved={(result) => handleSaved(result, "OTHER_DESIGNER_USE")}
          helperText="다른 디자이너의 급여를 계산하는 기능이 아닙니다. 내가 관리 중인 이 회원권을 다른 디자이너가 사용했을 때, 내 남은 횟수와 정산 영향만 반영합니다."
        />
      )}
      {activeAction === "ADJUSTMENT" && (
        <AdjustmentForm pass={pass} onSaved={(result) => handleSaved(result, "ADJUSTMENT")} />
      )}

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-500">이벤트 이력</p>
        {events.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
            아직 이벤트가 없습니다.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">
                    {event.date} · {MEMBERSHIP_EVENT_TYPE_LABELS[event.type]}
                  </span>
                  <span className="font-semibold">
                    {event.countImpact > 0 ? "+" : ""}
                    {event.countImpact}회
                  </span>
                </div>
                {event.settlementImpact !== 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    정산 {formatSignedWon(event.settlementImpact)}
                  </p>
                )}
                {event.memo && <p className="mt-1 text-xs text-zinc-400">{event.memo}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-white p-5">
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setShowDeleteConfirm(true);
          }}
          className="min-h-[48px] rounded-xl border border-red-600 py-3 text-center text-sm font-semibold text-red-600"
        >
          회원권 삭제
        </button>
        {deleteError && <p className="text-center text-sm text-red-500">{deleteError}</p>}
      </section>

      {showDeleteConfirm && (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-[340px] flex-col gap-3 rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="text-base font-semibold text-zinc-900">이 회원권을 삭제할까요?</p>
            <p className="text-sm text-zinc-500">
              회원권과 연결된 사용/조정 내역도 함께 삭제되며 과거 월정산 결과가 변경될 수
              있습니다.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="min-h-[48px] flex-1 rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={isDeleting}
                className="min-h-[48px] flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "1회 사용" / "타 디자이너 사용" 공용 폼. MVP에서는 1회 단위만 지원한다(count 고정 1) —
 * 여러 회차 입력은 불필요한 UI 복잡도라 이번 범위에서 만들지 않았다.
 */
function CountEventForm({
  pass,
  perUseAmount,
  compute,
  onSaved,
  helperText,
}: {
  pass: MembershipPass;
  perUseAmount: number;
  compute: (input: MembershipUseInput) => MembershipLedgerResult;
  onSaved: (result: MembershipLedgerResult) => void | Promise<void>;
  /** "타 디자이너 사용"처럼 오해하기 쉬운 동작에 짧게 의미를 설명하는 문구. */
  helperText?: string;
}) {
  const [date, setDate] = useState(todayDateString());
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ date?: string }>({});
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const errors: { date?: string } = {};
    if (!date.trim()) {
      errors.date = "날짜를 입력해주세요.";
    }

    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    try {
      const result = compute({
        id: crypto.randomUUID(),
        date,
        count: 1,
        memo: memo.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      onSaved(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs text-zinc-400">
        남은 횟수 {pass.remainingCount}회 · 1회 기준 매출 {formatWon(perUseAmount)}
      </p>
      {helperText && <p className="text-xs text-zinc-400">{helperText}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">날짜</span>
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
        onClick={handleSubmit}
        disabled={pass.remainingCount <= 0}
        className="mt-2 min-h-[48px] rounded-xl bg-zinc-900 py-3 text-center font-semibold text-white disabled:opacity-40"
      >
        1회 사용 확정
      </button>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}

function AdjustmentForm({
  pass,
  onSaved,
}: {
  pass: MembershipPass;
  onSaved: (result: MembershipLedgerResult) => void | Promise<void>;
}) {
  const [date, setDate] = useState(todayDateString());
  const [countImpactText, setCountImpactText] = useState("0");
  const [salesImpactText, setSalesImpactText] = useState("0");
  const [settlementImpactText, setSettlementImpactText] = useState("0");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    date?: string;
    countImpact?: string;
    salesImpact?: string;
    settlementImpact?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const countImpact = Number(countImpactText);
    const salesImpact = Number(salesImpactText);
    const settlementImpact = Number(settlementImpactText);

    const errors: {
      date?: string;
      countImpact?: string;
      salesImpact?: string;
      settlementImpact?: string;
    } = {};

    if (!date.trim()) {
      errors.date = "날짜를 입력해주세요.";
    }
    if (!countImpactText.trim() || !Number.isInteger(countImpact)) {
      errors.countImpact = "정수를 입력해주세요.";
    } else {
      const nextRemaining = pass.remainingCount + countImpact;
      if (nextRemaining < 0 || nextRemaining > pass.totalCount) {
        errors.countImpact = "남은 횟수 범위를 벗어나는 조정입니다.";
      }
    }
    if (!salesImpactText.trim() || !Number.isFinite(salesImpact)) {
      errors.salesImpact = "숫자를 입력해주세요.";
    }
    if (!settlementImpactText.trim() || !Number.isFinite(settlementImpact)) {
      errors.settlementImpact = "숫자를 입력해주세요.";
    }

    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    try {
      const result = adjustMembershipPass(pass, {
        id: crypto.randomUUID(),
        date,
        countImpact,
        salesImpact,
        settlementImpact,
        memo: memo.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      onSaved(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-zinc-400">
        자동 계산 없이 값을 직접 입력하는 수동 조정입니다. 횟수를 늘리려면 양수, 줄이려면
        음수를 입력하세요.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">날짜</span>
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
        <span className="text-sm text-zinc-500">횟수 증감 (예: +1, -1)</span>
        <input
          type="number"
          inputMode="numeric"
          value={countImpactText}
          onChange={(e) => {
            setCountImpactText(e.target.value);
            setFieldErrors((prev) => ({ ...prev, countImpact: undefined }));
          }}
          className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.countImpact)}`}
        />
        <FieldError message={fieldErrors.countImpact} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">매출 영향</span>
        <input
          type="number"
          inputMode="numeric"
          value={salesImpactText}
          onChange={(e) => {
            setSalesImpactText(e.target.value);
            setFieldErrors((prev) => ({ ...prev, salesImpact: undefined }));
          }}
          className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.salesImpact)}`}
        />
        <FieldError message={fieldErrors.salesImpact} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">정산 영향</span>
        <input
          type="number"
          inputMode="numeric"
          value={settlementImpactText}
          onChange={(e) => {
            setSettlementImpactText(e.target.value);
            setFieldErrors((prev) => ({ ...prev, settlementImpact: undefined }));
          }}
          className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.settlementImpact)}`}
        />
        <FieldError message={fieldErrors.settlementImpact} />
      </label>

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
        onClick={handleSubmit}
        className="mt-2 min-h-[48px] rounded-xl bg-red-600 py-3 text-center font-semibold text-white"
      >
        조정 저장
      </button>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
