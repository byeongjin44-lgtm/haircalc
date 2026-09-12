"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BONUS_SETTLEMENT_MODE_LABELS,
  PREPAID_EVENT_TYPE_LABELS,
  PREPAID_PASS_STATUS_LABELS,
  PREPAID_RECOGNITION_MODE_LABELS,
} from "@/lib/settlement/labels";
import { formatSignedWon, formatWon, todayDateString } from "@/lib/settlement/format";
import {
  adjustPrepaidPass,
  refundPrepaidCredit,
  useByOtherDesigner as applyOtherDesignerUse,
  useOwnPrepaidCredit as applyOwnUse,
  type PrepaidCreditEventInput,
  type PrepaidLedgerResult,
} from "@/lib/settlement/prepaid";
import {
  loadPrepaidEvents,
  loadPrepaidPasses,
  loadSettlementSettings,
  recordPrepaidLedgerResult,
} from "@/lib/settlement/storage";
import type { PrepaidEvent, PrepaidPass, SettlementSettings } from "@/lib/settlement/types";

type ActionType = "USE" | "OTHER_DESIGNER_USE" | "REFUND" | "ADJUSTMENT";

const ACTION_LABELS: Record<ActionType, string> = {
  USE: "내가 시술",
  OTHER_DESIGNER_USE: "타 디자이너 사용",
  REFUND: "환불",
  ADJUSTMENT: "조정",
};

export default function PrepaidDetailPage() {
  const params = useParams<{ id: string }>();
  const passId = params.id;

  const [settings, setSettings] = useState<SettlementSettings | null>(null);
  const [pass, setPass] = useState<PrepaidPass | null | undefined>(undefined);
  const [events, setEvents] = useState<PrepaidEvent[]>([]);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadedSettings = loadSettlementSettings();
    const loadedPass = loadPrepaidPasses().find((p) => p.id === passId) ?? null;
    const loadedEvents = loadPrepaidEvents()
      .filter((e) => e.prepaidPassId === passId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadedSettings);
    setPass(loadedPass);
    setEvents(loadedEvents);
  }, [passId]);

  function handleSaved(result: PrepaidLedgerResult) {
    recordPrepaidLedgerResult(result);
    setPass(result.pass);
    setEvents((prev) => [result.event, ...prev]);
    setActiveAction(null);
    setMessage(
      `저장 완료 · 매출 ${formatSignedWon(result.event.salesImpact)} · 정산 ${formatSignedWon(
        result.event.settlementImpact
      )}`
    );
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
        </div>
        {pass.memo && <p className="mt-3 text-xs text-zinc-400">{pass.memo}</p>}
      </section>

      {isActive && (
        <section className="grid grid-cols-4 gap-2">
          {(Object.keys(ACTION_LABELS) as ActionType[]).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => setActiveAction((prev) => (prev === action ? null : action))}
              className={`rounded-xl py-2 text-xs font-semibold ${
                activeAction === action
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700 shadow-sm"
              }`}
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </section>
      )}

      {activeAction === "USE" && (
        <CreditEventForm
          pass={pass}
          compute={(input) => applyOwnUse(pass, input, settings)}
          onSaved={handleSaved}
        />
      )}
      {activeAction === "OTHER_DESIGNER_USE" && (
        <CreditEventForm
          pass={pass}
          compute={(input) => applyOtherDesignerUse(pass, input, settings)}
          onSaved={handleSaved}
        />
      )}
      {activeAction === "REFUND" && (
        <CreditEventForm
          pass={pass}
          compute={(input) => refundPrepaidCredit(pass, input, settings)}
          onSaved={handleSaved}
        />
      )}
      {activeAction === "ADJUSTMENT" && (
        <AdjustmentForm pass={pass} onSaved={handleSaved} />
      )}

      {message && <p className="text-center text-sm text-zinc-500">{message}</p>}

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
    </div>
  );
}

function CreditEventForm({
  pass,
  compute,
  onSaved,
}: {
  pass: PrepaidPass;
  compute: (input: PrepaidCreditEventInput) => PrepaidLedgerResult;
  onSaved: (result: PrepaidLedgerResult) => void;
}) {
  const [date, setDate] = useState(todayDateString());
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");
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
    if (!isValid) {
      setError("사용/환불 금액을 입력해주세요.");
      return;
    }
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
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs text-zinc-400">현재 잔액 {formatWon(pass.remainingBalance)}</p>

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
        <span className="text-sm text-zinc-500">사용/환불 금액</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value);
            setError(null);
          }}
          className="rounded-lg border border-zinc-200 px-3 py-3 text-2xl font-semibold"
        />
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
        className="mt-2 rounded-xl bg-zinc-900 py-3 text-center font-semibold text-white"
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
  onSaved: (result: PrepaidLedgerResult) => void;
}) {
  const [date, setDate] = useState(todayDateString());
  const [creditAmountImpactText, setCreditAmountImpactText] = useState("0");
  const [salesImpactText, setSalesImpactText] = useState("0");
  const [settlementImpactText, setSettlementImpactText] = useState("0");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const creditAmountImpact = Number(creditAmountImpactText);
    const salesImpact = Number(salesImpactText);
    const settlementImpact = Number(settlementImpactText);

    if (![creditAmountImpact, salesImpact, settlementImpact].every(Number.isFinite)) {
      setError("숫자를 정확히 입력해주세요.");
      return;
    }

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
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-xs text-zinc-400">
        자동 계산 없이 값을 직접 입력하는 수동 조정입니다. 잔액을 늘리려면 양수, 줄이려면
        음수를 입력하세요.
      </p>

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
        <span className="text-sm text-zinc-500">잔액 증감</span>
        <input
          type="number"
          inputMode="numeric"
          value={creditAmountImpactText}
          onChange={(e) => setCreditAmountImpactText(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">매출 영향</span>
        <input
          type="number"
          inputMode="numeric"
          value={salesImpactText}
          onChange={(e) => setSalesImpactText(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">정산 영향</span>
        <input
          type="number"
          inputMode="numeric"
          value={settlementImpactText}
          onChange={(e) => setSettlementImpactText(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2"
        />
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
        className="mt-2 rounded-xl bg-zinc-900 py-3 text-center font-semibold text-white"
      >
        조정 저장
      </button>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
