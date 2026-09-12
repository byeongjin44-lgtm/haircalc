export default function SettlementPage() {
  const summaryItems = [
    "총매출",
    "예상 정산액",
    "실제 지급액",
    "차이금액",
    "일반매출",
    "정액권 반영액",
    "정액권 환수/조정",
    "기타 공제/조정",
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">월정산</h1>

      <section className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-5 shadow-sm">
        {summaryItems.map((label) => (
          <div key={label}>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-lg font-semibold">-</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-zinc-500">월간 달력</p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-400">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
          {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
            <div
              key={day}
              className="flex h-14 flex-col items-center justify-start gap-0.5 rounded-lg border border-zinc-100 py-1 text-zinc-700"
            >
              <span className="text-[11px]">{day}</span>
              <span className="text-[10px] text-zinc-400">-</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
