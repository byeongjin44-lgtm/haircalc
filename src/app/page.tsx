export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">홈</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">이번 달 예상 정산액</p>
        <p className="mt-1 text-3xl font-bold">-</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">이번 달 총매출</p>
          <p className="mt-1 text-lg font-semibold">-</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">이번 달 거래 건수</p>
          <p className="mt-1 text-lg font-semibold">-</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">정액권 조정</p>
          <p className="mt-1 text-lg font-semibold">-</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-zinc-500">환불/기타 공제</p>
          <p className="mt-1 text-lg font-semibold">-</p>
        </div>
      </section>
    </div>
  );
}
