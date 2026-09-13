"use client";

import { useEffect, useRef, useState } from "react";
import type {
  MaterialCostMode,
  SettlementSettings,
  VatMode,
} from "@/lib/settlement/types";
import {
  exportBackup,
  importBackup,
  loadSettlementSettings,
  saveSettlementSettings,
  validateBackup,
  wipeAllData,
} from "@/lib/settlement/storage";
import {
  clampNumber,
  percentToRate,
  rateToPercent,
  todayDateString,
} from "@/lib/settlement/format";
import {
  MATERIAL_COST_MODES,
  MATERIAL_COST_MODE_LABELS,
  VAT_MODES,
  VAT_MODE_LABELS,
} from "@/lib/settlement/labels";

interface SettingsFormState {
  baseIncentiveRate: string;
  newRate: string;
  returningRate: string;
  designatedRate: string;
  vatMode: VatMode;
  cardFeeEnabled: boolean;
  cardFeeRate: string;
  materialCostMode: MaterialCostMode;
  materialCostValue: string;
  withholding3_3: boolean;
}

function toFormState(settings: SettlementSettings): SettingsFormState {
  return {
    baseIncentiveRate: rateToPercent(settings.baseIncentiveRate),
    newRate:
      settings.customerTypeRates.NEW !== undefined
        ? rateToPercent(settings.customerTypeRates.NEW)
        : "",
    returningRate:
      settings.customerTypeRates.RETURNING !== undefined
        ? rateToPercent(settings.customerTypeRates.RETURNING)
        : "",
    designatedRate:
      settings.customerTypeRates.DESIGNATED !== undefined
        ? rateToPercent(settings.customerTypeRates.DESIGNATED)
        : "",
    vatMode: settings.vatMode,
    cardFeeEnabled: settings.cardFee.enabled,
    cardFeeRate: rateToPercent(settings.cardFee.rate),
    materialCostMode: settings.materialCost.mode,
    materialCostValue:
      settings.materialCost.mode === "PERCENT"
        ? rateToPercent(settings.materialCost.value)
        : String(settings.materialCost.value),
    withholding3_3: settings.withholding3_3,
  };
}

export default function SettingsPage() {
  const [current, setCurrent] = useState<SettlementSettings | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const settings = await loadSettlementSettings();
      // IndexedDB는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).

      setCurrent(settings);
      setForm(toFormState(settings));
    })();
  }, []);

  async function refreshSettings() {
    const settings = await loadSettlementSettings();
    setCurrent(settings);
    setForm(toFormState(settings));
  }

  if (!current || !form) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  function updateForm(patch: Partial<SettingsFormState>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setSavedMessage(null);
  }

  async function handleSave() {
    if (!current || !form) return;

    // 폼 레벨 입력 방어: 비율은 0~100%, 고정금액은 0 이상으로 잘라낸다 (엔진은 수정하지 않음).
    const clampRate = (value: number) => clampNumber(value, 0, 1);

    const customerTypeRates: SettlementSettings["customerTypeRates"] = {};
    if (form.newRate.trim() !== "") {
      customerTypeRates.NEW = clampRate(percentToRate(form.newRate));
    }
    if (form.returningRate.trim() !== "") {
      customerTypeRates.RETURNING = clampRate(percentToRate(form.returningRate));
    }
    if (form.designatedRate.trim() !== "") {
      customerTypeRates.DESIGNATED = clampRate(percentToRate(form.designatedRate));
    }

    const next: SettlementSettings = {
      ...current,
      baseIncentiveRate: clampRate(
        percentToRate(form.baseIncentiveRate, current.baseIncentiveRate)
      ),
      customerTypeRates,
      vatMode: form.vatMode,
      cardFee: {
        enabled: form.cardFeeEnabled,
        rate: clampRate(percentToRate(form.cardFeeRate, 0)),
      },
      materialCost: {
        mode: form.materialCostMode,
        value:
          form.materialCostMode === "PERCENT"
            ? clampRate(percentToRate(form.materialCostValue, 0))
            : clampNumber(Number(form.materialCostValue) || 0, 0, Number.MAX_SAFE_INTEGER),
      },
      withholding3_3: form.withholding3_3,
      updatedAt: new Date().toISOString(),
    };

    await saveSettlementSettings(next);
    setCurrent(next);
    setForm(toFormState(next));
    setSavedMessage("설정이 저장되었습니다.");
  }

  async function handleExport() {
    setDataMessage(null);
    const backup = await exportBackup();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `haircalc-backup-${todayDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDataMessage("백업 파일을 내보냈습니다.");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setDataMessage(null);

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setDataMessage("파일을 읽을 수 없습니다. 올바른 JSON 파일인지 확인해주세요.");
      return;
    }

    if (!validateBackup(parsed)) {
      setDataMessage("지원하지 않는 백업 파일입니다 (형식 또는 버전을 확인해주세요).");
      return;
    }

    const confirmed = window.confirm(
      "복원하면 현재 저장된 모든 데이터가 이 백업 파일 내용으로 완전히 대체됩니다. 계속하시겠습니까?"
    );
    if (!confirmed) return;

    await importBackup(parsed);
    await refreshSettings();
    setDataMessage("백업 파일에서 복원했습니다. 다른 화면도 새로고침하면 반영됩니다.");
  }

  async function handleWipeAll() {
    const confirmed = window.confirm(
      "정말 모든 데이터를 삭제하시겠습니까?\n정산 설정, 거래 내역, 정액권, 실제 지급액이 전부 삭제되며 되돌릴 수 없습니다."
    );
    if (!confirmed) return;

    await wipeAllData();
    await refreshSettings();
    setDataMessage("모든 데이터를 삭제했습니다.");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">정산 설정</h1>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">기본 설정</p>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">기본 인센티브율 (%)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={form.baseIncentiveRate}
            onChange={(e) => updateForm({ baseIncentiveRate: e.target.value })}
            className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">신규 고객 인센티브율 (%, 비워두면 기본값 사용)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={form.newRate}
            onChange={(e) => updateForm({ newRate: e.target.value })}
            className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">재방문 고객 인센티브율 (%, 비워두면 기본값 사용)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={form.returningRate}
            onChange={(e) => updateForm({ returningRate: e.target.value })}
            className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">지정 고객 인센티브율 (%, 비워두면 기본값 사용)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={form.designatedRate}
            onChange={(e) => updateForm({ designatedRate: e.target.value })}
            className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">고급 설정</p>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">부가세 처리</span>
          <select
            value={form.vatMode}
            onChange={(e) => updateForm({ vatMode: e.target.value as VatMode })}
            className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
          >
            {VAT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {VAT_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">카드수수료 적용</span>
          <input
            type="checkbox"
            checked={form.cardFeeEnabled}
            onChange={(e) => updateForm({ cardFeeEnabled: e.target.checked })}
            className="h-5 w-5"
          />
        </div>

        {form.cardFeeEnabled && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">카드수수료율 (%)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              value={form.cardFeeRate}
              onChange={(e) => updateForm({ cardFeeRate: e.target.value })}
              className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">재료비 처리 방식</span>
          <select
            value={form.materialCostMode}
            onChange={(e) =>
              updateForm({ materialCostMode: e.target.value as MaterialCostMode })
            }
            className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
          >
            {MATERIAL_COST_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MATERIAL_COST_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>

        {form.materialCostMode !== "NONE" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-500">
              재료비 {form.materialCostMode === "PERCENT" ? "비율 (%)" : "고정금액 (원)"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={form.materialCostMode === "PERCENT" ? 100 : undefined}
              value={form.materialCostValue}
              onChange={(e) => updateForm({ materialCostValue: e.target.value })}
              className="min-h-[44px] rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">3.3% 원천징수 반영</span>
          <input
            type="checkbox"
            checked={form.withholding3_3}
            onChange={(e) => updateForm({ withholding3_3: e.target.checked })}
            className="h-5 w-5"
          />
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        className="min-h-[52px] rounded-xl bg-zinc-900 py-3 text-center text-base font-semibold text-white"
      >
        저장
      </button>

      {savedMessage && (
        <p className="text-center text-sm text-zinc-500">{savedMessage}</p>
      )}

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">데이터 관리</p>
        <p className="text-xs text-zinc-400">
          데이터는 현재 이 기기에 저장됩니다. 기기 변경이나 브라우저 데이터 삭제 전에
          백업을 권장합니다.
        </p>

        <button
          type="button"
          onClick={handleExport}
          className="min-h-[48px] rounded-xl border border-zinc-200 py-2.5 text-center text-sm font-semibold"
        >
          백업 파일 내보내기
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          className="min-h-[48px] rounded-xl border border-zinc-200 py-2.5 text-center text-sm font-semibold"
        >
          백업 파일에서 복원
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleWipeAll}
          className="min-h-[48px] rounded-xl border border-red-200 py-2.5 text-center text-sm font-semibold text-red-600"
        >
          모든 데이터 삭제
        </button>

        {dataMessage && (
          <p className="text-center text-sm text-zinc-500">{dataMessage}</p>
        )}
      </section>
    </div>
  );
}
