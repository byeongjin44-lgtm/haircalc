import Link from "next/link";

const MORE_LINKS = [
  { href: "/history", label: "내역", description: "저장된 거래 목록 확인" },
  { href: "/settings", label: "설정", description: "정산 설정, 백업/복원, 데이터 관리" },
] as const;

export default function MorePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">더보기</h1>

      <ul className="flex flex-col gap-2">
        {MORE_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
            >
              <span>
                <span className="block font-semibold">{item.label}</span>
                <span className="block text-xs text-zinc-500">{item.description}</span>
              </span>
              <span className="text-zinc-300">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
