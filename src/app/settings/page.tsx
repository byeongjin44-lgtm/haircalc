"use client";

import { useEffect, useState } from "react";
import type {
  MaterialCostMode,
  SettlementSettings,
  VatMode,
} from "@/lib/settlement/types";
import { loadSettlementSettings, saveSettlementSettings } from "@/lib/settlement/storage";
import { percentToRate, rateToPercent } from "@/lib/settlement/format";
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

  useEffect(() => {
    const settings = loadSettlementSettings();
    // localStorage는 브라우저에서만 접근 가능해 마운트 이후에 읽어야 한다 (SSR 시 값이 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(settings);
    setForm(toFormState(settings));
  }, []);

  if (!current || !form) {
    return <p className="text-sm text-zinc-400">불러오는 중...</p>;
  }

  function updateForm(patch: Partial<SettingsFormState>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setSavedMessage(null);
  }

  function handleSave() {
    if (!current || !form) return;

    const customerTypeRates: SettlementSettings["customerTypeRates"] = {};
    if (form.newRate.trim() !== "") {
      customerTypeRates.NEW = percentToRate(form.newRate);
    }
    if (form.returningRate.trim() !== "") {
      customerTypeRates.RETURNING = percentToRate(form.returningRate);
    }
    if (form.designatedRate.trim() !== "") {
      customerTypeRates.DESIGNATED = percentToRate(form.designatedRate);
    }

    const next: SettlementSettings = {
      ...current,
      baseIncentiveRate: percentToRate(
        form.baseIncentiveRate,
        current.baseIncentiveRate
      ),
      customerTypeRates,
      vatMode: form.vatMode,
      cardFee: {
        enabled: form.cardFeeEnabled,
        rate: percentToRate(form.cardFeeRate, 0),
      },
      materialCost: {
        mode: form.materialCostMode,
        value:
          form.materialCostMode === "PERCENT"
            ? percentToRate(form.materialCostValue, 0)
            : Number(form.materialCostValue) || 0,
      },
      withholding3_3: form.withholding3_3,
      updatedAt: new Date().toISOString(),
    };

    saveSettlementSettings(next);
    setCurrent(next);
    setForm(toFormState(next));
    setSavedMessage("설정이 저장되었습니다.");
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
            value={form.baseIncentiveRate}
            onChange={(e) => updateForm({ baseIncentiveRate: e.target.value })}
            className="rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">신규 고객 인센티브율 (%, 비워두면 기본값 사용)</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.newRate}
            onChange={(e) => updateForm({ newRate: e.target.value })}
            className="rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">재방문 고객 인센티브율 (%, 비워두면 기본값 사용)</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.returningRate}
            onChange={(e) => updateForm({ returningRate: e.target.value })}
            className="rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">지정 고객 인센티브율 (%, 비워두면 기본값 사용)</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.designatedRate}
            onChange={(e) => updateForm({ designatedRate: e.target.value })}
            className="rounded-lg border border-zinc-200 px-3 py-2"
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
            className="rounded-lg border border-zinc-200 px-3 py-2"
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
              value={form.cardFeeRate}
              onChange={(e) => updateForm({ cardFeeRate: e.target.value })}
              className="rounded-lg border border-zinc-200 px-3 py-2"
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
            className="rounded-lg border border-zinc-200 px-3 py-2"
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
              value={form.materialCostValue}
              onChange={(e) => updateForm({ materialCostValue: e.target.value })}
              className="rounded-lg border border-zinc-200 px-3 py-2"
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
        className="rounded-xl bg-zinc-900 py-3 text-center font-semibold text-white"
      >
        저장
      </button>

      {savedMessage && (
        <p className="text-center text-sm text-zinc-500">{savedMessage}</p>
      )}
    </div>
  );
}
