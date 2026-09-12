# PROJECT_STATE.md

# 프리랜서 미용사 월급/정산 계산기 — PROJECT STATE

마지막 업데이트: 2026-09-12

## 1. 현재 상태

상태: NEXT 1~5 완료 (정액권 UI/월정산 연결 + UX 정리까지 실제 사용 가능) / NEXT 6(모바일 실사용) 전

정액권(선불권)을 데이터 모델 → 계산/원장 엔진 → UI → 홈/월정산 반영까지 전부 연결했다.
"정액권 판매 → 목록/잔액 확인 → 사용/타디자이너 사용/환불 → 홈/월정산 반영"이
실제로 동작한다. `prepaid.ts`의 계산 로직은 이번 PART에서 변경하지 않았다
(엔진은 이전 PART에서 53개 테스트로 검증 완료된 상태를 그대로 사용).

- 거래등록(`/entry`)은 탭 없이 단일 화면 — 결제수단 선택지에 "정액권"을 추가했다.
  "정액권"을 고르면 고객유형/시술유형 입력은 숨기고, 보유 중인(ACTIVE) 정액권 선택 /
  사용금액 / 현재 잔액을 보여준다. 저장 시 `useOwnPrepaidCredit` 엔진을 그대로 사용하고,
  나머지 카드/현금/계좌이체/플랫폼/기타 선택 시 동작은 기존과 동일하다
  (`PaymentType` 데이터 타입에는 "정액권"을 추가하지 않았다 — entry 화면 전용 UI 선택지
  `PaymentChoice = PaymentType | "PREPAID"`로만 분기하고, 실제 저장은 Transaction이 아닌
  PrepaidEvent로 기록된다).
- 정액권 등록(`/prepaid/new`) — 신규 정액권 생성 전용 화면. `purchasePrepaidPass` 엔진
  그대로 사용, 사용가능금액 기본값은 실결제금액과 동일(수정 가능). "정액권 판매"였던
  이전 화면을 그대로 옮기고 용어만 "정액권 등록"으로 통일했다.
- 정액권 목록(`/prepaid`) — 상단에 [+ 정액권 등록] 버튼(`/prepaid/new`로 이동).
  식별명/구매일/실결제·사용가능금액/잔액/정산방식/상태 표시,
  종료(DEPLETED·CLOSED)된 정액권은 회색으로 시각 구분.
- 정액권 상세(`/prepaid/[id]`) — [정액권 사용]/[타 디자이너 사용]/[환불]/[조정] 4개 액션
  (기존 "내가 시술" 명칭을 "정액권 사용"으로 통일). 앞의 3개는 각각
  `useOwnPrepaidCredit`/`useByOtherDesigner`/`refundPrepaidCredit`을 저장 전 미리보기에도
  그대로 재사용(같은 함수 호출 결과를 미리 보여주고, 저장 시 다시 호출해 실제로 기록).
  [조정]은 `adjustPrepaidPass`로 수동 입력값을 기록.
  하단에 이벤트 이력(날짜·유형·잔액영향·정산영향)을 최신순으로 표시.
- 홈(`/`)과 월정산(`/settlement`, `/settlement/[date]`) 모두
  `combinePeriodSummary(transactions, prepaidEvents)`로 일반 거래 snapshot 합계와
  정액권 이벤트(salesImpact/settlementImpact) 합계를 더해 최종 총매출/예상 정산액을 표시.
  정액권은 항상 "이벤트 발생일(date)" 기준으로 해당 월/일에만 집계되며, 과거 이벤트
  값은 재계산하지 않는다 (예: 9월 판매 후 10월 타디자이너 사용 환수는 10월에만 마이너스 반영).
  월정산 상단/홈에는 "정액권 조정 ±금액" 보조 라인도 표시.
- 실제 지급액(`MonthlyActualPayout`)은 그대로 두고, "차이" 계산 시 정액권까지 합산된
  최종 예상 정산액과 비교하도록 자동으로 반영됨(코드 변경 없이 `summary.totalSettlementAmount`가
  이미 combined 값이므로).

Next.js + TypeScript + Tailwind 프로젝트, 모바일 퍼스트 레이아웃(하단 탭 내비게이션),
홈 / 거래등록 / 내역 / 월정산 / 설정 5개 라우트 + 월정산 날짜별 상세(`/settlement/[date]`)
동적 라우트까지 만들었다.

`src/lib/settlement/types.ts`에 SettlementSettings, Transaction, PrepaidPass,
PrepaidEvent, MonthlyAdjustment, MonthlyActualPayout 타입을 정의했고,
`src/lib/settlement/engine.ts`에 UI와 완전히 분리된 순수 함수 기반
정산 계산 엔진을 구현했다 (엔진 자체는 이번 단계에서 수정하지 않음).

**"정산 설정 저장 → 일반 거래 입력 → 계산 엔진 적용 → 거래 저장 → 홈/월정산 집계 →
날짜별 상세"까지 전부 실제로 동작한다.**
- 정산설정(`/settings`): 인센티브율/VAT 방식/카드수수료/재료비/3.3% 저장, 새로고침 후 유지.
- 거래등록(`/entry`): 입력값 + 현재 설정으로 저장 전 예상 정산액 표시, 저장 시
  `buildTransactionSnapshot`으로 계산결과 snapshot 고정. 이후 설정 변경에 영향받지 않음.
- 내역(`/history`): 저장된 거래를 최신순으로 조회.
- 홈(`/`): 이번 달 저장된 Transaction을 `filterByMonth` + `summarizeTransactions`로 집계해
  이번 달 예상 정산액(가장 크게 표시)/총매출/거래 건수/평균 객단가/평균 정산율 표시.
  그래프·통계 없음.
- 월정산(`/settlement`): 상단에 총매출/예상 정산액/실제 지급액(입력·저장 가능)/차이,
  하단에 월간 달력(날짜별 하루 매출/하루 예상 정산액, "만원" 단위 축약 표기).
  이전달/다음달 이동 가능 (`shiftMonthKey`로 연도 경계 포함 정확히 처리).
  날짜 셀 클릭 시 `/settlement/[date]`로 이동해 당일 총매출/예상 정산액과
  거래별 금액/고객유형/시술유형/결제수단/적용 인센티브율/정산액을 저장된 snapshot
  그대로 표시 (재계산 없음).
- 실제 지급액은 새 타입 `MonthlyActualPayout` (month별 단일 금액)으로
  `localStorage`에 별도 저장 — `MonthlyAdjustment`(보너스/공제 등 이벤트 목록)와는
  용도가 달라 재사용하지 않음.

아직 하지 않은 것: 거래/정액권 이벤트 수정·삭제, PWA, 모바일 실사용 테스트(NEXT 6).

---

## 2. 확정된 제품 방향

- 대한민국 프리랜서/인센티브형 헤어 디자이너 개인용 정산 앱
- 단순 총매출 계산기가 아니라 거래 한 건씩 누적하는 정산 장부
- 이번 달 예상 정산금액을 실시간 확인
- 월말 실제 지급액과 예상액 비교 가능
- 빠른 첫 버전 출시 최우선
- 웹/PWA 우선
- Next.js + TypeScript + Tailwind 예정
- 초기 로컬 저장
- 서버/회원가입 없음
- Claude Code 주력 개발
- Codex는 검수/디버깅 보조로 사용 가능

---

## 3. 확정된 핵심 화면

### 홈
- 이번 달 예상 정산액
- 이번 달 총매출
- 거래 건수
- 정액권 조정
- 기타 공제 요약

### 거래 등록
- 금액
- 고객 유형
- 시술 유형
- 결제수단
- 메모
- 예상 정산금액

### 내역
- 날짜별 거래
- 수정/삭제
- 정액권 이벤트 포함

### 월정산
상단:
- 총매출
- 예상 정산액
- 실제 지급액
- 차이
- 일반매출
- 정액권 반영/환수
- 기타 공제

하단:
- 월간 달력
- 날짜별 하루 매출
- 날짜별 하루 정산금액
- 날짜 클릭 시 해당 날짜 상세 내역 이동

### 정산설정
- 기본 인센티브
- 고객 유형별 비율
- 시술별 비율
- 결제수단별 처리
- VAT
- 카드수수료
- 재료비
- 3.3%
- 정액권 정산방식

---

## 4. 확정된 정액권 요구사항

정액권은 별도 원장으로 관리한다.

### 판매 즉시 반영형
- 판매 시 원 담당 디자이너 매출/정산에 반영
- 이후 타 디자이너 사용 시 원 디자이너 환수 또는 매출 이관 가능
- 환불 시 원 디자이너 정산 환수 가능

### 사용 시 반영형
- 판매 시 디자이너 매출 미반영
- 실제 사용 시 담당 디자이너 매출/정산에 반영
- 미사용 잔액 환불은 디자이너 사용매출에 영향 없음

### 추적 이벤트
- PURCHASE
- USE
- REFUND
- TRANSFER
- ADJUSTMENT

### 보너스 정액권
예:
- 100만원 결제
- 110만원 사용가능

실결제금액과 사용가능금액을 분리 저장한다.

---

## 5. 아직 미확정 / 구현 중 판단 가능 항목

다음 항목은 개발하면서 MVP 관점에서 가장 단순한 방식을 선택한다.

- localStorage vs IndexedDB
- 정확한 UI 컴포넌트 구성
- 달력 라이브러리 사용 여부
- 정산 규칙 우선순위 세부 정책
- 정액권 타디자이너 사용 시 "매출 이관"과 "정산액 직접 환수" 중 내부 처리 방식
- 실제 지급액 입력 UI
- 백업/내보내기 방식
- 앱 정식 이름
- 배포 도메인

이 항목 때문에 개발을 멈추거나 과도한 설계를 하지 않는다.

---

## 6. 다음 작업

### NEXT 1 — 프로젝트 생성 (완료)
Claude Code로:
- [x] Next.js + TypeScript + Tailwind (App Router, src 디렉토리)
- [x] 모바일 퍼스트 (max-w-md 컨테이너 + 하단 탭 내비게이션)
- [x] 기본 라우팅: `/`(홈), `/entry`(거래등록), `/history`(내역), `/settlement`(월정산), `/settings`(설정)
- [x] MASTER.md / PROJECT_STATE.md / CLAUDE.md 유지 (덮어쓰지 않음)
- [x] `npm run build`, `npm run lint`, dev 서버 5개 라우트 200 응답 확인
- [x] git 저장소 초기화 (커밋은 아직 하지 않음, 사용자 명시 요청 시 진행)

각 화면은 아직 정적 골격만 존재하며 실제 계산/저장 로직은 없다.

### NEXT 2 — 데이터 모델 (완료)
`src/lib/settlement/types.ts`에 정의:
- [x] SettlementSettings (기본/고객유형별 인센티브율, VAT 방식, 카드수수료, 재료비, 3.3% 여부)
- [x] Transaction (계산 snapshot 필드 포함)
- [x] PrepaidPass (타입만 정의, 로직 없음)
- [x] PrepaidEvent (타입만 정의, 로직 없음 — PURCHASE/USE/REFUND/TRANSFER/ADJUSTMENT)
- [x] MonthlyAdjustment (타입만 정의, 로직 없음)

정액권 관련 타입은 이번 단계에서 구조만 정의했고,
계산 로직/UI는 NEXT 5에서 다룬다.

### NEXT 3 — 계산 엔진 (완료)
`src/lib/settlement/engine.ts`에 순수 함수로 구현, UI/저장소와 분리:
- [x] 기본 인센티브
- [x] 고객유형별(신규/재방문/지정) 인센티브
- [x] VAT 공제 없음
- [x] VAT 매출의 10% 단순 차감
- [x] VAT 포함금액 -> 공급가액 환산
- [x] 카드수수료 (결제수단이 카드일 때만 적용)
- [x] 재료비 (비율 / 고정금액)
- [x] 3.3% 원천징수 ON/OFF (정산액과 "예상 지급액"을 분리해서 표현)
- [x] `buildTransactionSnapshot`으로 거래 저장 시 계산 결과를 Transaction에 고정

핵심 함수: `calculateSettlement(amount, customerType, paymentType, settings)`.
계산 순서: 매출 → VAT 공제 → 재료비/카드수수료 공제 → 인센티브율 적용 → 3.3% 반영.

테스트: `npm test` (`node --test`, 별도 라이브러리 추가 없음).
16개 케이스 전부 통과 — 기본/고객유형별/VAT 3방식/카드수수료/재료비 2방식/
3.3% ON·OFF/복합 케이스/snapshot 불변성.

대표 계산 결과 예시:
- 매출 100,000원, 기본 인센티브 40%, 공제 없음 → 정산액 40,000원
- 매출 110,000원, VAT 공급가액환산, 40% → 공급가액 100,000원 → 정산액 40,000원
- 매출 100,000원, 카드결제(수수료 2%), 40% → 수수료 2,000원 공제 후 정산액 39,200원
- 매출 100,000원, 재료비 고정 8,000원, 40% → 정산액 36,800원
- 매출 100,000원, 40%, 3.3% ON → 정산액 40,000원 / 예상 지급액 38,680원
- 매출 110,000원, 지정고객(45%) + VAT 공급가액환산 + 카드수수료 3% + 재료비 고정 5,000원 + 3.3% ON
  → 정산 기준금액 91,700원 → 정산액 41,265원 → 예상 지급액 39,903원

### NEXT 4 — 최소 UI (완료, 정액권 제외)
- [x] 홈 (이번 달 실제 데이터 집계: 예상 정산액/총매출/건수/평균 객단가/평균 정산율)
- [x] 거래등록 (계산 엔진 연결 + 저장 전 예상 정산액 표시 + snapshot 저장)
- [x] 내역 (저장된 거래 목록 조회)
- [x] 월정산 (상단 요약 + 월간 달력 + 이전달/다음달 이동 + 실제 지급액 입력)
- [x] 월정산 날짜별 상세 (`/settlement/[date]`, 저장된 snapshot 그대로 표시, 재계산 없음)
- [x] 설정 (정산 규칙 저장/로드, localStorage 유지)

저장소: `src/lib/settlement/storage.ts` (localStorage 기반, 서버/DB 없음).
라벨/상수: `src/lib/settlement/labels.ts`, 포맷 유틸: `src/lib/settlement/format.ts`,
월 계산: `src/lib/settlement/month.ts`, 기간 집계: `src/lib/settlement/summary.ts`.

테스트: `npm test` — engine 16개 + month 9개 + summary 7개 = 32개, 전부 통과.
`month.test.ts`/`summary.test.ts`는 이번 단계에서 새로 추가 (엔진 자체는 미수정).

실사용 검증 (2026-09-12):
- 거래등록 단계: 시술금액 110,000원 / 재방문 / VAT 공급가액환산 / 인센티브 40% /
  카드수수료·재료비 없음 / 3.3% OFF → 저장 전 미리보기 정산액 40,000원 확인.
- 홈·월정산 단계: "같은 날 거래 2건 + 다른 날 거래 1건(이번 달) + 이전달 거래 1건"
  시나리오를 storage.ts/summary.ts/month.ts 함수로 그대로 재현해 확인 —
  홈 월 합계(총매출 180,000 / 정산액 72,000 / 3건), 날짜별 합계(9/12 150,000·2건,
  9/13 30,000·1건), 월 이동 시 이전달(20,000·1건)이 이번 달 집계에 섞이지 않음,
  날짜 상세 조회(2건), 실제 지급액 저장 후 재조회(70,000), "새로고침" 후에도
  거래 4건·정산액 72,000 유지 — 전부 기대값과 일치.
- dev 서버로 `/`, `/entry`, `/history`, `/settings`, `/settlement`,
  `/settlement/2026-09-12` 전부 200 응답 확인.
- 참고: 이 세션에서는 Claude in Chrome 확장이 연결되어 있지 않아 실제 브라우저
  클릭 조작 테스트는 수행하지 못했다. 위 검증은 UI가 호출하는 동일 함수를
  그대로 실행한 결과이며, 브라우저 수동 확인을 권장한다.

### NEXT 5 — 정액권 (완료)
- [x] 데이터 모델 (`PrepaidPass`, `PrepaidEvent` — `src/lib/settlement/types.ts`)
- [x] 계산/원장 엔진 (`src/lib/settlement/prepaid.ts`, 순수 함수)
- [x] 유닛 테스트 (`src/lib/settlement/prepaid.test.ts`, 21개, 지정된 15개 시나리오 + 잔액 무결성 추가 가드 4개)
- [x] 저장소 (`storage.ts`에 `loadPrepaidPasses`/`upsertPrepaidPass`/`loadPrepaidEvents`/
  `appendPrepaidEvent`/`recordPrepaidLedgerResult` 추가, localStorage 기반, 서버/DB 없음)
- [x] UI: 판매(`/entry` 탭) / 목록(`/prepaid`) / 상세+사용·타디자이너·환불·조정(`/prepaid/[id]`)
- [x] 홈/월정산/날짜상세 연결 (`combinePeriodSummary`로 일반 거래 + 정액권 이벤트 합산)

**데이터 모델 요약**
- `PrepaidPass`: id, purchaseDate, paidAmount, creditAmount, remainingBalance,
  recognitionMode(`SALE_IMMEDIATE`|`USE_BASED`), bonusSettlementMode(`CREDIT_AMOUNT`|`PAID_RATIO`),
  status(`ACTIVE`|`DEPLETED`|`CLOSED`), label?, memo?, createdAt.
  다중 디자이너 필드(originalOwner 등)는 두지 않음 — 단일 사용자 앱 전제.
- `PrepaidEvent`: id, prepaidPassId, type(`PURCHASE`|`USE`|`OTHER_DESIGNER_USE`|`REFUND`|`ADJUSTMENT`),
  date, creditAmountImpact, salesImpact, settlementImpact, commissionRateSnapshot?, memo?, createdAt.
  과거 이벤트는 수정하지 않고 새 이벤트만 추가 — 잔액은 이벤트의 creditAmountImpact 합으로 재계산 가능
  (`calculateBalanceFromEvents`로 검증).

**핵심 함수 (`src/lib/settlement/prepaid.ts`)**
`purchasePrepaidPass` / `useOwnPrepaidCredit` / `useByOtherDesigner` / `refundPrepaidCredit` /
`adjustPrepaidPass` / `closePrepaidPass` / `convertCreditToSalesAmount` / `calculateBalanceFromEvents`.

계산 규칙: SALE_IMMEDIATE는 구매 시 `paidAmount`(보너스 제외 실결제액) 기준으로 매출/정산을
즉시 인식하고, 본인 사용은 영향 없음, 타디자이너 사용/환불은 환수(음수 반영).
USE_BASED는 구매 시 영향 없음, 본인 사용 시점에 인식, 타디자이너 사용/환불은 영향 없음.
보너스권은 `bonusSettlementMode`에 따라 차감액을 그대로(CREDIT_AMOUNT) 또는
실결제 비율로 환산(PAID_RATIO, `creditAmount × paidAmount/creditAmount`, MASTER 예시
220,000 × 100만/110만 = 200,000과 일치)해 매출을 계산한다.
모든 정산 영향값은 이벤트 생성 시점 `settings.baseIncentiveRate`를 snapshot으로 고정 —
이후 설정이 바뀌어도 과거 이벤트 값은 불변 (테스트로 확인).
잔액 무결성: 초과 사용/환불 차단, 종료(CLOSED)된 정액권 추가 사용 차단,
조정이 0 미만 또는 creditAmount 초과로 가지 않도록 차단.

테스트: `npm test` — engine 16 + month 9 + summary 7 + prepaid 21 = 53개, 전부 통과.
`npm run lint`, `npm run build`(typecheck 포함)도 모두 통과.

**UI 연결 (이번 PART 추가)**
- `src/app/entry/page.tsx`: "일반 매출 / 정액권 판매" 탭. 정액권 판매 폼은
  `purchasePrepaidPass` 사용, 사용가능금액 기본값 = 실결제금액(수정 가능).
- `src/app/prepaid/page.tsx`: 정액권 목록. 식별명/구매일/실결제·사용가능금액/잔액/
  정산방식/상태 표시, 종료된 정액권은 회색으로 구분.
- `src/app/prepaid/[id]/page.tsx`: 상세 + [내가 시술]/[타 디자이너 사용]/[환불]/[조정].
  앞 3개는 `useOwnPrepaidCredit`/`useByOtherDesigner`/`refundPrepaidCredit`을 저장 전
  미리보기와 실제 저장에 동일하게 재사용. `[조정]`은 `adjustPrepaidPass`로 수동 입력.
  하단에 이벤트 이력(날짜·유형·잔액영향·정산영향)을 최신순으로 표시.
  (구현 메모: `useOwnPrepaidCredit`/`useByOtherDesigner`처럼 이름이 "use"로 시작하는
  일반 함수를 컴포넌트 안에서 호출하면 eslint `react-hooks` 규칙이 React 훅으로 오인해
  오류가 나서, import 시 `applyOwnUse`/`applyOtherDesignerUse`로 별칭만 붙였다.
  prepaid.ts의 실제 함수/로직은 변경하지 않음.)
- `src/app/page.tsx`(홈), `src/app/settlement/page.tsx`, `src/app/settlement/[date]/page.tsx`:
  `summary.ts`에 추가한 `filterPrepaidEventsByMonth`/`filterPrepaidEventsByDate`/
  `groupPrepaidEventsByDate`/`summarizePrepaidEvents`/`combinePeriodSummary`로
  일반 거래 합계 + 정액권 이벤트 영향을 더해 표시. 정액권은 이벤트의 `date` 기준으로
  월/일에 귀속되며, 과거 이벤트를 수정해 지난달 숫자를 바꾸지 않는다.
  홈/월정산 상단에 "정액권 조정 ±금액" 보조 라인 추가.

**통합 테스트 (이번 PART 추가, 지시된 A~E 시나리오)**
- `src/lib/settlement/prepaid-integration.test.ts` (4개): A) 9월 일반매출 100만+정산 40만
  + SALE_IMMEDIATE 정액권 판매 100만/정산 40만 → 9월 합계 200만/80만.
  B) 10월 타디자이너 사용 20만 환수 → 10월 매출 -20만/정산 -8만, 9월 합계는 불변(100만/40만).
  C) USE_BASED 구매(구매월 영향 0) → 다음달 본인 사용 20만 → 사용월 매출 +20만/정산 +8만.
  D) PAID_RATIO 100만/110만 보너스권 22만 사용 → 매출 +20만/정산 +8만.
- `src/lib/settlement/prepaid-storage.test.ts` (1개, 시나리오 E): 판매+본인사용 후
  localStorage에서 다시 읽어도(=새로고침) 잔액/이벤트 수/월합계가 동일함을 확인.
- 최종 테스트 수: engine 16 + month 9 + summary 7 + prepaid 21 + prepaid-integration 4 +
  prepaid-storage 1 = **58개, 전부 통과**.

**엔드투엔드 수동 검증** (UI가 호출하는 동일 함수로 재현, localStorage는 in-memory로 대체):
1. 일반 매출 100만원 등록 → 정산 40만원
2. SALE_IMMEDIATE 100만원권 판매 → 매출 100만/정산 40만원 반영
3. 목록 조회 → 정액권 1건, 잔액 100만원
4. 내가 시술 20만원 사용 → 잔액 80만원, 매출/정산 영향 0 (SALE_IMMEDIATE라 이미 인식됨)
5. 타 디자이너 사용 10만원 → 잔액 70만원, 매출 -10만/정산 -4만
6. 환불 20만원 → 잔액 50만원, 매출 -20만/정산 -8만
7. 9월 합계 = 일반(100만/40만) + 정액권 순영향(100만-10만-20만=70만 / 40만-4만-8만=28만)
   = 총매출 170만원, 예상 정산액 68만원
8. 9/18(타디자이너 사용일) 날짜 상세 = 매출 -10만원, 정산 -4만원
9. "새로고침" 후 정액권 1건/이벤트 4건/잔액 50만원/9월 합계 170만·68만 모두 동일
→ 전부 기대값과 일치.

dev 서버로 `/`, `/entry`, `/history`, `/settings`, `/settlement`, `/settlement/2026-09-12`,
`/prepaid`, `/prepaid/[존재하지 않는 id]` 전부 200 응답 확인 (없는 정액권은 클라이언트에서
"정액권을 찾을 수 없습니다" 안내, 하드 404는 아님). Claude in Chrome 확장이 이 세션에 연결되어
있지 않아 실제 브라우저 클릭 조작 테스트는 하지 못함 — 위 검증은 UI와 동일한 함수 호출로 대체.

**UX 수정 (2026-09-12, 별도 PART): 정액권 신규 등록과 정액권 결제 혼동 문제 해결**

기능 테스트에서 `/entry`의 "일반 매출 / 정액권 판매" 탭이 "새 정액권 만들기"와
"보유 정액권으로 결제"를 혼동시킨다는 문제가 확인되어 UI/라우팅만 재구성했다.
계산 엔진(`engine.ts`, `prepaid.ts`)과 데이터 구조(`types.ts`)는 전혀 수정하지 않았다.

- `/entry`: 상단 탭 제거, 단일 거래등록 화면으로 복귀. 결제수단 선택지에 "정액권"을
  추가했지만 이는 화면 전용 타입 `PaymentChoice = PaymentType | "PREPAID"`일 뿐,
  `PaymentType`(데이터 구조)에는 추가하지 않았다. "정액권"을 고르면 고객유형/시술유형은
  숨기고 보유 정액권 선택(ACTIVE만) / 사용금액 / 현재 잔액을 보여주며, 저장 시
  `useOwnPrepaidCredit`을 호출해 PrepaidEvent로 기록한다(Transaction이 아님).
  카드/현금/계좌이체/플랫폼/기타는 기존과 동일하게 `buildTransactionSnapshot` 사용.
- `/prepaid`: 상단 링크를 "+ 정액권 등록" → `/prepaid/new`로 변경. 목록 자체는 그대로.
- `/prepaid/new` (신규 라우트): 기존 `/entry`의 정액권 판매 폼을 그대로 옮겼다.
  `purchasePrepaidPass` 엔진 재사용, 버튼/메시지 문구를 "등록 저장"/"등록 완료"로 통일.
- `/prepaid/[id]`: 액션 버튼 "내가 시술" → "정액권 사용"으로 명칭 변경 (동작은 동일,
  `useOwnPrepaidCredit` 그대로 사용). 타 디자이너 사용/환불/조정은 변경 없음.
- 용어 통일: "정액권 등록"(신규 생성) vs "정액권 사용"(보유 정액권으로 결제) —
  화면 어디에도 "정액권 판매"라는 표현이 남지 않도록 정리했다(코드 내 grep으로 확인).

구현 메모: `/entry`에서 정액권 사용 미리보기를 `useMemo`로 계산했더니 React Compiler
ESLint 플러그인이 "Compilation Skipped: Existing memoization could not be preserved"
오류를 냈다. 성능이 중요한 계산이 아니라서 `useMemo`를 걷어내고 렌더링마다 그냥
다시 계산하는 일반 함수 호출로 바꿔 해결했다(로직 변경 없음).

검증: `npm run lint`/`npm test`(기존 58개 그대로 통과)/`npm run build` 모두 통과.
`/prepaid/new` 라우트가 정적으로 추가 생성됨을 빌드 로그로 확인. dev 서버로
`/entry`, `/prepaid`, `/prepaid/new` 렌더링 및 "정액권 판매" 문자열이 더 이상
없음을 확인. `/entry`에서 정액권 결제 흐름(정액권 선택 → 사용금액 입력 → 저장 →
새로고침)을 storage.ts/prepaid.ts 함수로 직접 재현해 잔액/매출/정산 영향이
기존 `/prepaid/[id]` 경로와 동일하게 계산됨을 확인.

### NEXT 6 — 모바일 실사용 테스트
실제 휴대폰에서:
- 거래 등록
- 월 합계
- 달력
- 정액권
- 새로고침 후 데이터 유지
확인

---

## 7. v0.1 완료 조건

다음 시나리오가 오류 없이 가능하면 1차 출시 대상으로 판단한다.

1. 사용자가 매장 정산규칙을 설정한다.
2. 일반 시술 10건 이상을 등록한다.
3. 고객유형/결제방식/시술에 따라 서로 다른 정산금액이 계산된다.
4. 정액권 1건을 판매한다.
5. 정액권을 일부 사용한다.
6. 정액권 일부 환불 또는 조정을 입력한다.
7. 월정산 달력에서 날짜별 매출/정산액을 확인한다.
8. 날짜를 눌러 상세 내역을 확인한다.
9. 이번 달 예상 정산액을 확인한다.
10. 실제 지급액을 입력해 차이를 확인한다.
11. 페이지 새로고침/재실행 후 데이터가 유지된다.
12. 모바일 화면에서 실사용에 문제가 없다.

---

## 8. 현재 알려진 핵심 리스크

### 정산식 다양성
매장마다 계산 순서가 다르다.
→ 완전 자유형 수식 엔진 대신 MVP에서 흔한 옵션 조합으로 대응.

### 정액권
가장 복잡한 영역.
→ 일반 Transaction과 분리된 이벤트 원장 구조 사용.

### 과거 데이터 변경
설정 변경으로 지난달 결과가 달라질 수 있음.
→ 거래 저장 시 계산 규칙/결과 snapshot 저장.

### 기능 과확장
POS, 예약, 회원가입 등으로 범위가 커질 위험.
→ v0.1에서는 전부 제외.

---

## 9. 운영 원칙

의미 있는 기능 단위가 끝날 때마다:
1. 실행/테스트
2. PROJECT_STATE.md 업데이트
3. git status / diff 확인
4. commit
5. push

오류가 있으면 새 기능 추가보다 기존 기능 복구를 우선한다.

PROJECT_STATE.md는 항상 실제 코드 상태와 일치해야 한다.
