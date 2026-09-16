import Link from "next/link";
import type { ReactNode } from "react";

function ExampleCard({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">{children}</div>;
}

/** 되돌릴 수 없는 동작(정액권 삭제 등)에만 쓰는 강조 카드. */
function WarningCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">{children}</div>
  );
}

interface GuideSection {
  id: string;
  title: string;
  summary: string;
  body: ReactNode;
}

/**
 * 실제 코드(engine.ts, prepaid.ts, membership.ts, settings 화면)에 존재하는 항목만 설명한다.
 * 아직 구현되지 않은 기능은 넣지 않는다.
 */
const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "entry",
    title: "A. 거래 등록",
    summary: "고객 시술이 끝난 뒤 실제 결제된 거래를 등록합니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>거래 등록 화면에서는 아래 값을 입력합니다.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>날짜 — 시술이 있었던 날짜</li>
          <li>시술 금액 — 실제 결제된 금액</li>
          <li>고객 유형 — 신규 / 재방문 / 지정 / 기타</li>
          <li>시술 유형 — 컷 / 펌 / 염색 / 클리닉 / 제품판매 / 기타</li>
          <li>결제수단 — 카드 / 현금 / 계좌이체 / 플랫폼 / 기타</li>
        </ul>
        <ExampleCard>
          저장한 거래는 <strong className="text-zinc-800">등록 당시의 정산 설정</strong>을
          기준으로 계산됩니다. 나중에 정산 설정을 바꾸더라도 이미 등록된 거래의 정산 결과는
          바뀌지 않습니다.
        </ExampleCard>
      </div>
    ),
  },
  {
    id: "settings",
    title: "B. 정산 설정",
    summary: "매장의 정산 규칙을 정하는 화면입니다.",
    body: (
      <ul className="list-disc space-y-1.5 pl-4 text-sm text-zinc-600">
        <li>
          <strong className="text-zinc-800">기본 인센티브율</strong> — 고객 유형별 비율을
          따로 정하지 않았을 때 적용되는 기본 비율입니다.
        </li>
        <li>
          <strong className="text-zinc-800">신규 / 재방문 / 지정</strong> — 고객 유형별로
          다른 인센티브율을 쓰고 싶을 때만 입력합니다. 비워두면 기본 인센티브율이
          적용됩니다.
        </li>
        <li>
          <strong className="text-zinc-800">VAT(부가세) 처리</strong> — 공제 없음 / 10% 단순
          차감 / 공급가액 환산(결제금액 ÷ 1.1) 중 매장 방식에 맞게 선택합니다.
        </li>
        <li>
          <strong className="text-zinc-800">카드수수료</strong> — 켜두면 결제수단이
          카드인 거래에만 수수료율만큼 공제 후 정산합니다.
        </li>
        <li>
          <strong className="text-zinc-800">재료비</strong> — 시술 금액의 비율(%) 또는
          고정 금액(원)으로 공제할 수 있습니다.
        </li>
        <li>
          <strong className="text-zinc-800">3.3% 원천징수 반영</strong> — 켜두면 정산액과
          별도로 3.3%를 뗀 &quot;예상 지급액&quot;을 함께 보여줍니다.
        </li>
      </ul>
    ),
  },
  {
    id: "prepaid-intro",
    title: "C. 정액권이란?",
    summary: "고객이 미리 금액을 결제하고 이후 시술 때 잔액에서 차감해 사용하는 선불권입니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>정액권은 잔액이 남는 선불권이라 일반 거래와 별도로 관리합니다.</p>
        <ExampleCard>
          <p>
            <strong className="text-zinc-800">정액권 등록</strong> — 새 정액권을 만들어
            파는 것 (고객이 처음 결제하는 시점)
          </p>
          <p className="mt-1">
            <strong className="text-zinc-800">정액권 사용</strong> — 이미 있는 정액권
            잔액에서 시술비를 차감하는 것
          </p>
        </ExampleCard>
      </div>
    ),
  },
  {
    id: "prepaid-amounts",
    title: "D. 실결제금액 / 사용가능금액",
    summary: "보너스가 있는 정액권은 결제한 금액보다 더 많이 사용할 수 있습니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <ExampleCard>
          실결제금액 1,000,000원 / 사용가능금액 1,100,000원
          <p className="mt-1 text-zinc-500">
            → 고객이 100만원을 결제하고 10만원의 보너스를 받아 총 110만원을 사용할 수
            있는 정액권입니다.
          </p>
        </ExampleCard>
        <p>
          정액권 등록 화면의 보너스 빠른 선택(없음/5/10/15/20/30%)은 사용가능금액을
          편하게 계산하기 위한 기능입니다. 계산된 사용가능금액은 이후 직접 수정할 수도
          있습니다.
        </p>
      </div>
    ),
  },
  {
    id: "recognition-mode",
    title: "E. 판매 즉시 반영 / 사용 시 반영",
    summary: "정액권 매출을 언제 내 정산에 반영할지 정하는 방식입니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>
          <strong className="text-zinc-800">판매 즉시 반영</strong> — 정액권을 판매한
          달에 매출과 정산을 반영합니다. 이후 정액권을 사용할 때는 이미 반영된 매출이라
          다시 내 매출로 계산하지 않습니다.
        </p>
        <p>
          <strong className="text-zinc-800">사용 시 반영</strong> — 정액권을 판매할 때는
          정산하지 않고, 실제 시술에 사용된 금액을 사용할 때마다 매출과 정산에
          반영합니다.
        </p>
        <ExampleCard>
          100만원 정액권 판매 시
          <p className="mt-1">판매 즉시 반영 → 판매한 달에 100만원 기준으로 반영</p>
          <p className="mt-1">
            사용 시 반영 → 판매 시 0원, 이후 실제 사용한 금액만 순차적으로 반영
          </p>
        </ExampleCard>
      </div>
    ),
  },
  {
    id: "bonus-mode",
    title: "F. 실결제 비율 환산 / 차감금액 기준",
    summary: "보너스가 있는 정액권에서만 두 방식의 결과가 달라집니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>
          보너스가 없는 정액권(예: 100만원 결제 / 100만원 사용가능)은 두 방식의 결과가
          같습니다.
        </p>
        <ExampleCard>
          100만원 결제 / 110만원 사용가능 정액권에서 22만원 사용 시
          <p className="mt-1">
            <strong className="text-zinc-800">실결제 비율 환산</strong> → 보너스를 제외한
            실제 결제 비율만 인정 → 20만원 매출 인정
          </p>
          <p className="mt-1">
            <strong className="text-zinc-800">차감금액 기준</strong> → 정액권에서 차감된
            금액 전체 인정 → 22만원 매출 인정
          </p>
        </ExampleCard>
      </div>
    ),
  },
  {
    id: "other-designer",
    title: "G. 타 디자이너 사용",
    summary: "이 앱은 디자이너 개인 정산용입니다. 정액권과 회원권 모두 해당합니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>
          내가 판매한 정액권/회원권을 다른 디자이너가 사용한 경우, 내 정산에서 필요한
          차감이나 조정을 기록하기 위한 기능입니다.
        </p>
        <p>
          다른 디자이너의 급여를 계산해주는 기능이 아니라, 어디까지나 내 정산 기록을
          맞추기 위한 용도입니다.
        </p>
        <WarningCard>
          이 앱은 현재 개인 기기에 저장되는 로컬 저장 방식입니다. 다른 디자이너가 실제
          매장에서 내 고객의 정액권/회원권을 사용해도 이 앱이 자동으로 알 수 없습니다.
          그런 경우가 생기면 정액권/회원권 상세(또는 목록의 &quot;타 디자이너
          사용&quot;)에서 직접 기록해야 잔액/횟수와 정산액이 정확해집니다. 목록·상세에
          표시되는 잔액/남은 횟수는 항상 &quot;이 앱에 기록된 내역 기준&quot;입니다.
        </WarningCard>
      </div>
    ),
  },
  {
    id: "refund-adjust-delete",
    title: "H. 환불 / 조정 / 삭제",
    summary: "정액권 상세 화면에서 할 수 있는 그 외 동작들입니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="text-zinc-800">환불</strong> — 남은 정액권 금액 중 환불된
            금액을 기록합니다.
          </li>
          <li>
            <strong className="text-zinc-800">전액 버튼</strong> — 환불 금액 입력창에
            현재 남은 잔액을 자동으로 채워줍니다.
          </li>
          <li>
            <strong className="text-zinc-800">조정</strong> — 자동 계산에 맞지 않는
            특수한 상황에서 잔액/매출/정산 영향을 직접 보정할 때 사용합니다.
          </li>
        </ul>
        <WarningCard>
          정액권을 삭제하면 연결된 사용/환불/조정 내역도 함께 삭제되며, 그 정액권이
          반영됐던 과거 월정산 결과가 바뀔 수 있습니다. 잘못 등록한 정액권을 지울 때만
          신중하게 사용하세요.
        </WarningCard>
      </div>
    ),
  },
  {
    id: "monthly",
    title: "I. 월정산",
    summary: "이번 달 현황을 한눈에 확인하고, 날짜별 상세 내역도 볼 수 있습니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>월정산 화면 상단에서 월별로 아래 항목을 확인할 수 있습니다.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>총매출</li>
          <li>예상 정산액</li>
          <li>실제 지급액 (직접 입력해서 비교)</li>
          <li>차이</li>
          <li>정액권 영향</li>
        </ul>
        <p>하단 달력에서 날짜를 선택하면 그날 등록된 거래 내역을 볼 수 있습니다.</p>
      </div>
    ),
  },
  {
    id: "data",
    title: "J. 데이터 저장 / 백업",
    summary: "데이터는 이 기기와 브라우저에만 저장됩니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>
          현재 버전은 계정이나 클라우드 동기화 없이, 지금 사용 중인 기기와 브라우저에만
          데이터를 저장합니다. 다른 기기에서는 자동으로 데이터가 공유되지 않습니다.
        </p>
        <ExampleCard>
          기기를 바꾸거나 브라우저 데이터를 삭제하기 전에는{" "}
          <strong className="text-zinc-800">설정 → 데이터 관리</strong>에서 JSON 백업
          파일을 내보내 두는 것을 권장합니다. 나중에 같은 화면에서 백업 파일을 불러와
          복원할 수 있습니다.
        </ExampleCard>
      </div>
    ),
  },
  {
    id: "discount",
    title: "K. 정액권 사용 할인",
    summary: "정액권으로 결제하면 시술가에서 일정 %를 할인해주는 정액권도 등록할 수 있습니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>
          정액권 등록 화면에서 &quot;정액권 사용 할인율&quot;을 설정하면, 그 정액권으로
          결제할 때마다 시술가에서 할인이 적용된 만큼만 정액권 잔액에서 차감됩니다.
        </p>
        <ExampleCard>
          정상 시술가 10만원 / 정액권 할인 10% → 실제 정액권 차감 9만원
        </ExampleCard>
        <p>할인이 있는 정액권은 디자이너 매출을 인정하는 기준도 함께 선택합니다.</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="text-zinc-800">할인 후 금액 기준</strong> — 정액권에서 실제
            차감된 금액을 매출로 인정합니다.
          </li>
          <li>
            <strong className="text-zinc-800">정상 시술가 기준</strong> — 고객에게는
            할인을 적용하지만, 매출은 할인 전 원래 시술가로 인정합니다.
          </li>
        </ul>
        <p className="text-xs text-zinc-400">
          할인율을 설정하지 않은 정액권(기존 정액권 포함)은 이 기능과 무관하게 지금까지와
          동일하게 동작합니다.
        </p>
      </div>
    ),
  },
  {
    id: "membership",
    title: "L. 회원권",
    summary: "정액권은 금액을 차감하고, 회원권은 횟수를 차감합니다.",
    body: (
      <div className="flex flex-col gap-2 text-sm text-zinc-600">
        <p>
          <strong className="text-zinc-800">정액권</strong>은 결제한 금액에서 사용한
          금액만큼 잔액이 줄어들지만, <strong className="text-zinc-800">회원권</strong>은
          정해진 횟수에서 사용한 횟수만큼만 줄어듭니다.
        </p>
        <ExampleCard>
          클리닉 10회권 50만원 등록
          <p className="mt-1 text-zinc-500">→ 1회 사용 → 9회 남음 (금액은 따로 차감되지 않음)</p>
        </ExampleCard>
        <p>회원권도 정액권과 똑같이 정산 반영 방식을 선택합니다.</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="text-zinc-800">사용 시 반영</strong> — 판매 시에는 정산하지
            않고, 1회 사용할 때마다 (실결제금액 ÷ 전체횟수)만큼을 매출로 반영합니다.
          </li>
          <li>
            <strong className="text-zinc-800">판매 즉시 반영</strong> — 판매한 시점에 전체
            결제금액을 정산에 반영합니다. 이후 본인이 사용할 때는 횟수만 차감되고 중복으로
            정산하지 않습니다.
          </li>
        </ul>
        <p>
          거래 등록 화면에서 결제수단을 <strong className="text-zinc-800">회원권</strong>으로
          선택하면 금액을 입력하는 대신 사용할 회원권을 선택해 1회 사용으로 기록합니다.
        </p>
      </div>
    ),
  },
];

export default function SettingsGuidePage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/settings" className="text-sm text-zinc-500">
        ← 설정
      </Link>

      <h1 className="text-xl font-bold">사용 설명서</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-zinc-900">처음이라면 이것만 알아두세요</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-zinc-600">
          <li className="rounded-xl bg-zinc-50 px-3 py-2">
            일반 시술 결제 <span className="font-semibold text-zinc-900">→ 거래 등록</span>
          </li>
          <li className="rounded-xl bg-zinc-50 px-3 py-2">
            새 정액권 판매 <span className="font-semibold text-zinc-900">→ 정액권 등록</span>
          </li>
          <li className="rounded-xl bg-zinc-50 px-3 py-2">
            정액권으로 시술 결제{" "}
            <span className="font-semibold text-zinc-900">
              → 거래 등록 → 결제수단 정액권
            </span>
          </li>
          <li className="rounded-xl bg-zinc-50 px-3 py-2">
            이번 달 받을 예상 금액 <span className="font-semibold text-zinc-900">→ 월정산</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-zinc-400">
          정산 방식이 헷갈리면 아래 항목을 펼쳐서 확인하세요.
        </p>
      </section>

      <div className="flex flex-col gap-2">
        {GUIDE_SECTIONS.map((section) => (
          <details key={section.id} className="group rounded-2xl bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{section.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{section.summary}</p>
              </div>
              <span className="shrink-0 text-zinc-300 transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <div className="mt-3 border-t border-zinc-100 pt-3">{section.body}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
