"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FieldError, fieldBorderClass } from "@/components/FieldError";
import { useSuccessOverlay } from "@/components/SuccessOverlay";
import {
  BONUS_SETTLEMENT_MODE_LABELS,
  PREPAID_DISCOUNT_SETTLEMENT_BASIS_LABELS,
  PREPAID_EVENT_TYPE_LABELS,
  PREPAID_PASS_STATUS_LABELS,
  PREPAID_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatSignedWon, formatWon, todayDateString } from "@/lib/settlement/format";
import {
  adjustPrepaidPass,
  refundPrepaidCredit,
  resolveDiscountRate,
  resolveDiscountSettlementBasis,
  useByOtherDesigner as applyOtherDesignerUse,
  useOwnPrepaidCredit as applyOwnUse,
  type PrepaidCreditEventInput,
  type PrepaidLedgerResult,
} from "@/lib/settlement/prepaid";
import {
  deletePrepaidPass,
  loadPrepaidEvents,
  loadPrepaidPasses,
  loadSettlementSettings,
  recordPrepaidLedgerResult,
} from "@/lib/settlement/storage";
import type { PrepaidEvent, PrepaidPass, SettlementSettings } from "@/lib/settlement/types";

type ActionType = "USE" | "OTHER_DESIGNER_USE" | "REFUND" | "ADJUSTMENT";

const ACTION_LABELS: Record<ActionType, string> = {
  USE: "정액권 사용",
  OTHER_DESIGNER_USE: "타 디자이너 사용",
  REFUND: "환불",
  ADJUSTMENT: "조정",
};

/** 환불/조정은 잔액·매출을 되돌리는 위험도가 높은 동작이라 일반 사용과 다른 색으로 구분한다. */
const RISKY_ACTIONS: readonly ActionType[] = ["REFUND", "ADJUSTMENT"];

const ACTION_SUCCESS_MESSAGES: Record<ActionType, string> = {
  USE: "정액권 사용이 등록되었습니다.",
  OTHER_DESIGNER_USE: "타 디자이너 사용이 반영되었습니다.",
  REFUND: "환불이 반영되었습니다.",
  ADJUSTMENT: "조정이 반영되었습니다.",
};

export default function PrepaidDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const passId = params.id;
  const { showSuccess } = useSuccessOverlay();

  const [settings, setSettings] = useState<SettlementSettings | null>(null);
  const [pass, setPass] = useState<PrepaidPass | null | undefined>(undefined);
  const [events, setEvents] = useState<PrepaidEvent[]>([]);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [loadedSettings, loadedPasses, loadedAllEvents] = await Promise.all([
        loadSettlementSettings(),
        loadPrepaidPasses(),
        loadPrepaidEvents(),
      ]);
      const loadedPass = loadedPasses.find((p) => p.id === passId) ?? null;
      const loadedEvents = loadedAllEvents
        .filter((e) => e.prepaidPassId === passId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setSettings(loadedSettings);
      setPass(loadedPass);
      setEvents(loadedEvents);
    })();
  }, [passId]);

  async function handleSaved(result: PrepaidLedgerResult, action: ActionType) {
    try {
      await recordPrepaidLedgerResult(result);
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
      await deletePrepaidPass(passId);
    } catch (e) {
      // 삭제 실패 시에는 성공 오버레이/이동 없이 화면에 오류만 남긴다.
      setDeleteError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      setIsDeleting(false);
      return;
    }

    setShowDeleteConfirm(false);
    showSuccess("정액권이 삭제되었습니다.");
    router.push("/prepaid");
  }

  if (pass === undefined || !settings) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  if (pass === null) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/prepaid" className="text-sm text-zinc-500">
          ← 정액권 목록으로
        </Link>
        <div className="rounded-2xl bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
          정액권을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  const isActive = pass.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/prepaid" className="text-sm text-zinc-500">
        ← 정액권 목록으로
      </Link>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{pass.label || `정액권 (${pass.purchaseDate})`}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              isActive ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
            }`}
          >
            {PREPAID_PASS_STATUS_LABELS[pass.status]}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500">실결제금액</p>
            <p className="font-semibold">{formatWon(pass.paidAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">사용가능금액</p>
            <p className="font-semibold">{formatWon(pass.creditAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">현재 잔액</p>
            <p className="text-xl font-bold">{formatWon(pass.remainingBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">정산 방식</p>
            <p className="font-semibold">
              {PREPAID_RECOGNITION_MODE_LABELS[pass.recognitionMode]}
            </p>
            <p className="text-xs text-zinc-400">
              보너스: {BONUS_SETTLEMENT_MODE_LABELS[pass.bonusSettlementMode]}
            </p>
          </div>
          {resolveDiscountRate(pass) > 0 && (
            <div>
              <p className="text-xs text-zinc-500">정액권 할인</p>
              <p className="font-semibold">{Math.round(resolveDiscountRate(pass) * 100)}%</p>
              <p className="text-xs text-zinc-400">
                정산 기준: {PREPAID_DISCOUNT_SETTLEMENT_BASIS_LABELS[resolveDiscountSettlementBasis(pass)]}
              </p>
            </div>
          )}
        </div>
        {pass.memo && <p className="mt-3 text-xs text-zinc-400">{pass.memo}</p>}
      </section>

      {isActive && (
        <section className="grid grid-cols-4 gap-2">
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
        <CreditEventForm
          pass={pass}
          compute={(input) => applyOwnUse(pass, input, settings)}
          onSaved={(result) => handleSaved(result, "USE")}
        />
      )}
      {activeAction === "OTHER_DESIGNER_USE" && (
        <CreditEventForm
          pass={pass}
          compute={(input) => applyOtherDesignerUse(pass, input, settings)}
          onSaved={(result) => handleSaved(result, "OTHER_DESIGNER_USE")}
          helperText="다른 디자이너의 급여를 계산하는 기능이 아닙니다. 내가 관리 중인 이 정액권을 다른 디자이너가 사용했을 때, 내 잔액과 정산 영향만 반영합니다."
        />
      )}
      {activeAction === "REFUND" && (
        <CreditEventForm
          pass={pass}
          compute={(input) => refundPrepaidCredit(pass, input, settings)}
          onSaved={(result) => handleSaved(result, "REFUND")}
          variant="risky"
          showFillBalanceButton
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
                    {event.date} · {PREPAID_EVENT_TYPE_LABELS[event.type]}
                  </span>
                  <span className="font-semibold">
                    {formatSignedWon(event.creditAmountImpact)}
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
          정액권 삭제
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
            <p className="text-base font-semibold text-zinc-900">이 정액권을 삭제할까요?</p>
            <p className="text-sm text-zinc-500">
              정액권과 연결된 사용/환불/조정 내역도 함께 삭제되며 월정산 결과가 변경될 수
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

function CreditEventForm({
  pass,
  compute,
  onSaved,
  variant = "default",
  showFillBalanceButton = false,
  helperText,
}: {
  pass: PrepaidPass;
  compute: (input: PrepaidCreditEventInput) => PrepaidLedgerResult;
  onSaved: (result: PrepaidLedgerResult) => void | Promise<void>;
  variant?: "default" | "risky";
  showFillBalanceButton?: boolean;
  /** "타 디자이너 사용"처럼 오해하기 쉬운 동작에 짧게 의미를 설명하는 문구. */
  helperText?: string;
}) {
  const [date, setDate] = useState(todayDateString());
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ date?: string; amount?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText);
  const isValid = Number.isFinite(amount) && amount > 0;

  const preview = useMemo(() => {
    if (!isValid) return null;
    try {
      return compute({ id: "preview", date, creditAmount: amount, createdAt: new Date().toISOString() });
    } catch {
      return null;
    }
  }, [isValid, amount, date, compute]);

  function handleSubmit() {
    const errors: { date?: string; amount?: string } = {};

    if (!date.trim()) {
      errors.date = "날짜를 입력해주세요.";
    }
    if (!amountText.trim()) {
      errors.amount = "금액을 입력해주세요.";
    } else if (!isValid) {
      errors.amount = "0보다 큰 금액을 입력해주세요.";
    } else if (amount > pass.remainingBalance) {
      errors.amount = "정액권 잔액보다 많이 사용할 수 없습니다.";
    }

    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    try {
      const now = new Date().toISOString();
      const result = compute({
        id: crypto.randomUUID(),
        date,
        creditAmount: amount,
        memo: memo.trim() || undefined,
        createdAt: now,
      });
      onSaved(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ${
        variant === "risky" ? "border border-red-200" : ""
      }`}
    >
      <p className="text-xs text-zinc-400">현재 잔액 {formatWon(pass.remainingBalance)}</p>
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
        <span className="text-sm text-zinc-500">사용/환불 금액</span>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value);
              setFieldErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            className={`flex-1 rounded-lg border px-3 py-3 text-2xl font-semibold ${fieldBorderClass(!!fieldErrors.amount)}`}
          />
          {showFillBalanceButton && (
            <button
              type="button"
              disabled={pass.remainingBalance <= 0}
              onClick={() => {
                setAmountText(String(pass.remainingBalance));
                setFieldErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              className="rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 disabled:opacity-40"
            >
              전액
            </button>
          )}
        </div>
        <FieldError message={fieldErrors.amount} />
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

      {preview && (
        <div className="rounded-xl bg-zinc-50 p-4 text-sm">
          <p className="flex justify-between">
            <span className="text-zinc-500">정산 반영 매출</span>
            <span>{formatSignedWon(preview.event.salesImpact)}</span>
          </p>
          <p className="mt-1 flex justify-between font-semibold">
            <span>정산 영향</span>
            <span>{formatSignedWon(preview.event.settlementImpact)}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            사용 후 잔액 {formatWon(preview.pass.remainingBalance)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        className={`mt-2 min-h-[48px] rounded-xl py-3 text-center font-semibold text-white ${
          variant === "risky" ? "bg-red-600" : "bg-zinc-900"
        }`}
      >
        저장
      </button>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}

function AdjustmentForm({
  pass,
  onSaved,
}: {
  pass: PrepaidPass;
  onSaved: (result: PrepaidLedgerResult) => void | Promise<void>;
}) {
  const [date, setDate] = useState(todayDateString());
  const [creditAmountImpactText, setCreditAmountImpactText] = useState("0");
  const [salesImpactText, setSalesImpactText] = useState("0");
  const [settlementImpactText, setSettlementImpactText] = useState("0");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    date?: string;
    creditAmountImpact?: string;
    salesImpact?: string;
    settlementImpact?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const creditAmountImpact = Number(creditAmountImpactText);
    const salesImpact = Number(salesImpactText);
    const settlementImpact = Number(settlementImpactText);

    const errors: {
      date?: string;
      creditAmountImpact?: string;
      salesImpact?: string;
      settlementImpact?: string;
    } = {};

    if (!date.trim()) {
      errors.date = "날짜를 입력해주세요.";
    }
    if (!creditAmountImpactText.trim() || !Number.isFinite(creditAmountImpact)) {
      errors.creditAmountImpact = "숫자를 입력해주세요.";
    } else {
      const nextBalance = pass.remainingBalance + creditAmountImpact;
      if (nextBalance < 0 || nextBalance > pass.creditAmount) {
        errors.creditAmountImpact = "잔액 범위를 벗어나는 조정입니다.";
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
      const result = adjustPrepaidPass(pass, {
        id: crypto.randomUUID(),
        date,
        creditAmountImpact,
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
        자동 계산 없이 값을 직접 입력하는 수동 조정입니다. 잔액을 늘리려면 양수, 줄이려면
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
        <span className="text-sm text-zinc-500">잔액 증감</span>
        <input
          type="number"
          inputMode="numeric"
          value={creditAmountImpactText}
          onChange={(e) => {
            setCreditAmountImpactText(e.target.value);
            setFieldErrors((prev) => ({ ...prev, creditAmountImpact: undefined }));
          }}
          className={`rounded-lg border px-3 py-2 ${fieldBorderClass(!!fieldErrors.creditAmountImpact)}`}
        />
        <FieldError message={fieldErrors.creditAmountImpact} />
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
