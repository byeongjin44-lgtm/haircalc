# PROJECT_STATE.md

# 프리랜서 미용사 월급/정산 계산기 — PROJECT STATE

마지막 업데이트: 2026-09-14

작업 브랜치 안내: main은 실사용자 Production 안정판이다. 이 PART(정액권 stale state
버그 수정/UX 개선)는 `dev` 브랜치에서 작업했고, 아직 main에 병합/push하지 않았다.
커밋도 아직 하지 않은 상태다(사용자 명시 지시).

## 1. 현재 상태

상태: 핵심 기능 완료 + IndexedDB 완료 + 모바일 UX 완료 + PWA 준비 완료 +
실기기 UX 개선(설치 흐름/저장 피드백) 완료 + 저장 성공 피드백/입력 오류 인라인 표시 완료 +
**(dev 브랜치, 미병합) 정액권 등록 stale state 버그 수정 + 보너스 빠른 선택 +
정액권 삭제 + 환불 전액 버튼 완료** / 다음 단계: dev 실기기 재검증 → main 병합 →
실제 배포(Vercel)

**정액권 등록 stale state 버그 수정 + UX 보강 (2026-09-14, dev 브랜치)**: 실기기에서
"정액권 신규등록 화면에서 정산 방식을 다시 클릭하지 않고 저장하면 직전에 등록했던
값으로 저장된다"는 버그가 보고되어 원인을 찾아 수정했다. 계산 엔진(`engine.ts`,
`prepaid.ts`), `types.ts`, `recordStore.*`, `migration.ts`, `backup.ts`는 전혀 수정하지
않았다 (`git diff --stat`으로 무변경 재확인).

1. **stale state 버그의 정확한 원인**: `/prepaid/new`, `/entry`의 `정산 방식`/
   `보너스 정산 방식` 선택 UI(`ChoiceGroup`) 자체는 처음부터 `defaultValue`/
   `defaultChecked` 없이 완전히 React state(`useState`)로만 제어되고 있었다 — 코드
   레벨의 uncontrolled 버그는 아니었다. 실제 원인은 **Next.js 16.3의 navigation state
   preservation**(라우트를 떠나도 즉시 언마운트하지 않고 Activity로 "hidden" 상태만
   되면서 컴포넌트의 `useState` 값을 그대로 들고 있는 동작)이다. 정액권 A를
   PAID_RATIO로 등록하고 다른 화면을 거쳐 짧은 시간 안에 다시 `/prepaid/new`로
   돌아오면, 화면은 다시 그려지는 것처럼 보여도 실제 `useState` 값은 직전 방문(정액권
   A 등록 시점)의 값을 그대로 들고 있어, 버튼을 새로 클릭하지 않고 저장하면
   `purchasePrepaidPass`에 그 이전 값이 그대로 전달됐다. `defaultValue`/
   `defaultChecked`/`useRef`/이중 state 등은 프로젝트 전체(grep)에서 발견되지 않았다.
2. **수정 방식**: 처음에는 `next.config.ts`의 `experimental.staleTimes`와
   `/entry`·`/prepaid/new`의 `force-dynamic` layout으로 서버/캐시 정책을 바꿔
   우회하려 했으나, 사용자 지시에 따라 **전역/서버 캐시 정책으로 폼 state 문제를
   해결하지 않는 방향으로 다시 구현했다** — 두 설정 모두 제거했고 `next.config.ts`는
   이 PART 이전 상태로 완전히 복원했다(`experimental.staleTimes` 없음, `force-dynamic`
   layout 없음). 대신 각 폼 컴포넌트 안에서 **명시적으로 초기 상태를 정의하고
   리셋한다**: `INITIAL_PREPAID_NEW_FORM`/`INITIAL_ENTRY_FORM` 상수(모든 `useState`
   초기값이 이 한 곳만 참조)와 `resetForm()` 함수를 각각 정의하고, `useLayoutEffect`의
   **cleanup**에서 `resetForm()`을 호출한다. Next.js 16.3의 Activity가 라우트를
   hidden으로 전환하거나 실제로 언마운트할 때 effect cleanup이 실행되는 것을 이용해,
   화면을 떠나는 시점에 항상 폼을 초기화하고 다시 보여질 때는 새 폼으로 시작하게
   했다. 화면의 선택 하이라이트는 여전히 `value === option` 형태로 실제 state만
   보고 렌더링되므로, "화면 selected 상태 = 실제 저장 state"가 항상 성립한다.
3. **새로고침 없이 정상 동작하는지**: 새로고침(`location.reload`)은 코드 어디에도
   추가하지 않았다. `resetForm()`은 순수하게 컴포넌트 내부 `useState` setter만
   호출하는 일반 함수이고, cleanup은 React가 hidden/unmount 시점에 자동으로 호출해
   주므로 페이지를 새로고침하지 않아도 재방문 시 항상 초기 상태에서 시작한다. (이
   세션은 서버 환경이라 실기기에서 "등록 → 목록 → 재진입"을 반복하는 실제 재현은
   못 했고, 실기기 재검증이 필요하다.)

4. **버튼 표시 순서 변경 (`labels.ts`)**: 기본값 정책은 그대로 두고 화면 표시 순서만
   바꿨다 — `PREPAID_RECOGNITION_MODES`를 `[USE_BASED, SALE_IMMEDIATE]`
   ("사용 시 반영" 먼저), `BONUS_SETTLEMENT_MODES`를 `[PAID_RATIO, CREDIT_AMOUNT]`
   ("실결제 비율 환산" 먼저) 순으로 재정렬했다. `/prepaid/new`의 `useState` 기본값은
   여전히 `SALE_IMMEDIATE`/`CREDIT_AMOUNT` 그대로다(선택 하이라이트는 버튼 위치가
   아니라 실제 state 값만 기준으로 표시되므로 순서 변경과 기본값은 서로 독립적이다).
5. **입력 순서 + 보너스 빠른 선택 (`/prepaid/new`)**: 식별명 → 실결제금액 →
   사용가능금액 순서는 기존과 동일하게 유지됐고, 그 바로 아래에 "보너스" 드롭다운
   (없음 0%/+5%/+10%/+15%/+20%/+30%)을 신규 추가했다. 선택 시
   `creditAmount = round(paidAmount × (1+bonusRate))` 공식으로 사용가능금액 입력을
   자동 채운다(원 단위 정수 반올림, `format.ts`의 신규 순수함수 `applyBonusRate`).
   `bonusRate` 자체는 UI 편의값일 뿐 `PrepaidPass`에는 기존과 동일하게 `paidAmount`/
   `creditAmount`만 저장된다(새 필드 없음). 자동입력 후에도 사용가능금액 입력은 그대로
   직접 수정 가능한 일반 `<input>`이다.
6. **보너스 정산방식 설명 (`/prepaid/new`)**: "보너스 정산 방식" 선택지 아래에 실결제
   비율 환산/차감금액 기준 각각의 의미와 22만원 사용 예시(20만원 vs 22만원 인정),
   "보너스가 없으면 두 방식 결과가 같다"는 설명을 짧게 추가했다.
7. **정액권 삭제 기능 (`/prepaid/[id]`)**: 화면 하단에 빨간 테두리의 "정액권 삭제"
   버튼을 추가했다. 클릭 시 `window.confirm`이 아닌 프로젝트 내부 확인 오버레이
   (배경 dim+blur, "취소"/"삭제" 버튼)가 뜨고, "삭제"를 눌러야 실제 삭제가 진행된다.
   저장 계층에는 `storage.ts`에 신규 함수 `deletePrepaidPassFromStore(store, passId)`
   (RecordStore를 인자로 받아 Node 테스트 가능)와 이를 감싸는 `deletePrepaidPass(passId)`
   를 추가했다 — 기존 `recordStore.ts`/`recordStore.indexeddb.ts`/`recordStore.memory.ts`
   는 전혀 수정하지 않고, 이미 인터페이스에 있던 `delete()`만 사용했다(IndexedDB 직접
   우회 없음). 삭제는 해당 PrepaidPass와 `prepaidPassId`가 일치하는 모든 PrepaidEvent를
   함께 지운다 — 삭제 성공 시 `/prepaid` 목록으로 이동하며 중앙 성공 오버레이
   "정액권이 삭제되었습니다."를 띄우고, 실패 시 오버레이 없이 폼에 오류만 남긴다.
8. **환불 폼 "전액" 버튼 (`/prepaid/[id]`)**: 환불(`REFUND`) 액션의 `CreditEventForm`에만
   `showFillBalanceButton` prop으로 "전액" 버튼을 추가했다. 클릭하면 금액 입력에
   기존 `pass.remainingBalance`(엔진이 이벤트 이력으로 계산해 저장해 둔 현재 잔액)를
   그대로 채워 넣는다 — 별도 잔액 계산식을 새로 만들지 않았다. 이후 값은 직접 수정
   가능하고, 잔액이 0이면 버튼이 비활성화된다. 실제 환불 처리(정산 영향 계산)는
   기존 `refundPrepaidCredit` 그대로 사용한다.
9. **`/entry` state reset**: `/entry`도 처음부터 모든 선택 UI(고객유형/시술유형/
   결제수단)가 `useState` 기반 컨트롤드 state였고 `defaultValue`류 문제는 없었다.
   같은 화면에 남아있는 "저장 성공 후 연속 입력" 흐름과, "화면을 실제로 떠났다가
   돌아오는" 흐름을 명확히 분리했다: 저장 성공 시 `handleSave` 안에서는 기존 그대로
   `amountText`/`memo`만 초기화하고 날짜·고객유형·시술유형·결제수단·선택한 정액권은
   그대로 유지한다(기존 정책 그대로, 코드도 손대지 않음). 반면 `useLayoutEffect`
   cleanup에서 호출하는 `resetForm()`은 이 두 흐름과 별개로, 화면을 실제로 떠날
   때(hidden 전환/언마운트)만 날짜/금액/고객유형/시술유형/결제수단/선택한 정액권/
   메모/검증 오류를 전부 초기값으로 되돌린다 — 같은 화면에서 저장을 반복하는 동안은
   이 cleanup이 실행되지 않으므로 연속 입력 편의성에는 영향이 없다.

검증: `npm run lint` 통과(경고 없음) / `npm test` 76개 전부 통과(기존 71개 + 신규
5개: `format.test.ts`의 `applyBonusRate` 3개, `storage.test.ts`의
`deletePrepaidPassFromStore` 2개 — 정액권 삭제가 대상 pass/event만 지우고 다른
pass/event에 영향 없음을 검증) / `npm run build` 정상 완료, `/entry`·`/prepaid/new`는
"○(Static)"으로 그대로다(이번엔 force-dynamic으로 바꾸지 않았다). `git diff --stat`으로
`engine.ts`/`prepaid.ts`/`types.ts`/`recordStore.*`/`migration.ts`/`backup.ts`가 완전히
무변경임을 재확인했다(`storage.ts`는 기존 함수를 건드리지 않고 신규 함수만 추가하는
방식으로만 수정). `next.config.ts`에 `experimental.staleTimes` 없음, `/entry`·
`/prepaid/new`에 force-dynamic용 layout 없음을 재확인했다. A(재진입 시 실제 state와
화면 기본값 일치)는 React 컴포넌트 마운트/언마운트 타이밍에 의존하는 문제라 Node
테스트로 직접 재현할 수 없어 코드 리뷰(각 폼의 `resetForm()`이 모든 transient state를
빠짐없이 초기화하는지 확인)로 검증했고, 실기기에서 "등록 → 목록 → 재진입 → 저장"을
반복하는 최종 재현 테스트가 필요하다.

**저장 피드백/입력 검증 강화 (2026-09-13)**: 실기기 테스트에서 "저장 성공 피드백과
입력 유효성 오류가 눈에 잘 띄지 않는다"는 문제만 수정했다. 계산 엔진(`engine.ts`,
`prepaid.ts`), IndexedDB 구조, migration, backup/restore, 데이터 모델, 정산 계산식은
전혀 수정하지 않았다 (`git diff --stat`으로 무변경 재확인).

1. **하단 Toast → 중앙 SuccessOverlay 전환** — `src/components/Toast.tsx`를 삭제하고
   `src/components/SuccessOverlay.tsx`(신규, Context 기반, 외부 라이브러리 없음)로
   교체했다. `layout.tsx`에서 `SuccessOverlayProvider`로 전역 마운트. 화면 정중앙에
   `bg-black/40 backdrop-blur-sm` 배경 위에 `max-w-[320px]` 흰색 카드(✓ 아이콘 +
   메시지 + [확인] 버튼)를 띄운다. [확인]을 누르면 즉시 닫히고, 아무 동작이 없으면
   1.5초 후 자동으로 닫힌다 (`alert()`/`confirm()`/외부 modal 라이브러리 미사용).
   이전 Toast의 "내역 보기" 보조 액션은 새 명세(버튼 1개짜리 확인 오버레이)에 맞춰
   제거했다.
   - `/entry` 일반 매출 저장 성공 → "매출이 등록되었습니다."
   - `/entry` 정액권 결제 저장 성공 → "정액권 사용이 등록되었습니다."
   - `/prepaid/new` 등록 성공 → "정액권이 등록되었습니다." (성공 후 상세 페이지로
     이동하는 기존 동작 유지 — Provider가 루트 레이아웃에 있어 라우트 이동 중에도
     오버레이가 정상 표시된다)
   - `/prepaid/[id]` 정액권 사용/타 디자이너 사용/환불/조정 각각 →
     "정액권 사용이 등록되었습니다." / "타 디자이너 사용이 반영되었습니다." /
     "환불이 반영되었습니다." / "조정이 반영되었습니다." (메시지 문구 자체는
     이전 PART에서 이미 확정된 값 그대로, 전달 방식만 Toast→Overlay로 교체)
   - 저장이 실패(`catch`)하면 4곳 모두 성공 오버레이를 호출하지 않는다.
2. **필드별 인라인 유효성 검사 추가** — `src/components/FieldError.tsx`(신규)의
   `<FieldError>` 컴포넌트(빨간 텍스트)와 `fieldBorderClass()`(빨간 테두리 클래스)를
   공유 유틸로 만들어 3개 화면에 동일하게 적용했다. 화면 하단의 작은 검은 오류
   메시지는 필드 검증 용도로 더 이상 쓰지 않는다 — 필드 오류는 해당 입력 바로
   아래 빨간 문구 + 빨간 테두리로, 예상 못한 저장 실패(IndexedDB 오류 등)는 폼
   하단의 별도 빨간 배경 배너(`formError`/`error` state)로 구분해서 보여준다.
   저장 시도 전에는 오류를 표시하지 않고, 저장 버튼을 눌렀을 때만 검증하며,
   해당 필드를 다시 수정하면 그 필드의 오류만 즉시 사라진다.
   - `/entry` 일반 거래: 날짜/금액(>0)/고객유형/시술유형/결제수단 필수.
   - `/entry` 정액권 결제(결제수단=정액권): 정액권 선택 필수, 사용금액(>0) 필수,
     잔액 초과 시 "정액권 잔액보다 많이 사용할 수 없습니다." (기존 prepaid 엔진의
     잔액 검증은 그대로 유지 — UI 쪽은 사전 안내만 추가).
   - `/prepaid/new`: 정액권 식별명을 필수값으로 변경(trim 후 빈 문자열이면 오류,
     라벨에 "정액권 식별명 *" 표시), 날짜/실결제금액(>0)/사용가능금액(>0) 필수.
   - `/prepaid/[id]`: 정액권 사용/타 디자이너 사용/환불(`CreditEventForm`)에
     날짜/금액(>0)/잔액 초과 차단 검증 추가. 조정(`AdjustmentForm`)은 잔액
     증감/매출 영향/정산 영향 3개 숫자 필드를 각각 개별 검증하고, 잔액 증감은
     추가로 `remainingBalance + creditAmountImpact`가 `[0, creditAmount]` 범위를
     벗어나면 오류를 표시한다.
   - `customerType`/`serviceType`/`paymentChoice`는 버튼형 선택지라 항상 기본값이
     있어 "비어있는" 상태가 UI상 존재하지 않는다 — 그래도 명세대로 방어적 검증은
     구현해뒀다(현재 UI에서는 실질적으로 트리거되지 않는 안전장치).

검증: `npm run lint` 통과(경고 없음) / `npm test` 기존 71개 전부 통과(로직 무변경,
결과 동일) / `npm run build` 타입체크 포함 정상 완료. `git diff --stat`으로
`engine.ts`/`prepaid.ts`/`types.ts`/`recordStore.*`/`migration.ts`/`backup.ts`/
`storage.ts`가 완전히 무변경임을 재확인했다. A~G 시나리오는 코드 레벨로 검증했다
(빈 금액/빈 식별명/사용금액 없음/잔액 초과 시 필드별 빨간 오류 + 저장 차단,
정상 저장 시 중앙 오버레이 노출 + 자동/수동 닫힘, 실패 시 오버레이 미노출) —
이 세션은 서버 환경이라 실제 브라우저에서 터치/1.5초 타이머 동작까지는 확인하지
못했고, 실기기 확인이 필요하다.

## 1-1. 이전 실기기 UX 개선(설치 흐름/Toast 저장 피드백) 기록 (2026-09-13)

**실기기 UX 개선 (2026-09-13)**: 실기기 배포 테스트에서 발견된 문제 2건만 수정했다.
계산 엔진(`engine.ts`, `prepaid.ts`), IndexedDB 구조, migration, backup/restore,
데이터 모델은 전혀 수정하지 않았다.

1. **PWA 설치 UX** — 홈 화면 아이콘 실행 시 standalone이 아니라 일반 Chrome으로
   열리는 문제. `manifest.ts`에 `id: "/"`, `scope: "/"`를 명시했다(아이콘/색상/이름은
   유지). `src/components/InstallPwaButton.tsx`(신규)가 `beforeinstallprompt`를
   가로채 `/more` 상단에 "헤어정산 앱 설치" 버튼을 노출한다 —
   `window.matchMedia("(display-mode: standalone)")`로 이미 설치된 상태면 버튼을
   숨기고, `appinstalled` 이벤트 후에도 숨긴다. beforeinstallprompt를 못 받는
   환경(iOS 등)에서는 버튼 대신 "브라우저 메뉴에서 앱 설치를 선택할 수 있습니다."
   짧은 안내만 보여준다(깨진 버튼 없음, 복잡한 브라우저별 가이드 없음).
2. **저장 완료 피드백 부재** — 저장 버튼을 눌러도 화면 변화가 거의 없던 문제.
   외부 라이브러리 없이 `src/components/Toast.tsx`(신규, Context 기반)로 가벼운
   Toast/Snackbar를 만들어 `layout.tsx`에 `ToastProvider`로 전역 마운트했다.
   하단 네비게이션과 겹치지 않게 그 위쪽에 고정 표시, 약 1.8초 후 자동 소멸,
   `alert()`/큰 모달 없음, 화면 조작을 막지 않는다.
   - `/entry` 일반 매출 저장 성공 → "매출이 등록되었습니다." 토스트 +
     [내역 보기] 액션(누르면 `/history`로 이동, 자동 이동 없음). 금액/메모만
     초기화하고 날짜·고객유형·시술유형·결제수단은 유지해 연속 입력이 편하다.
   - `/entry` 정액권 결제 저장 성공 → "정액권 사용이 등록되었습니다." 토스트.
     사용금액 초기화, 선택된 정액권은 유지되어 최신(차감된) 잔액이 바로 보인다.
     자동 이동 없음.
   - `/prepaid/new` 등록 성공 → "정액권이 등록되었습니다." 토스트 후
     생성된 정액권 상세(`/prepaid/[id]`)로 이동 (정액권 등록은 반복 빈도가 낮아
     이동을 허용).
   - `/prepaid/[id]`의 [정액권 사용]/[타 디자이너 사용]/[환불]/[조정] 각각 성공 시
     "정액권 사용이 등록되었습니다." / "타 디자이너 사용이 반영되었습니다." /
     "환불이 반영되었습니다." / "조정이 반영되었습니다." 토스트로 구분.
   - 4곳 전부 저장(IndexedDB write)이 실패하면 `catch`에서 성공 토스트/이동 없이
     화면에 오류 메시지만 남기도록 처리했다 (성공 피드백이 실패 케이스에 새는 경우 없음).

검증: `npm run lint` / `npm test`(기존 71개 그대로 통과, 로직 무변경) /
`npm run build`(typecheck 포함) 모두 통과. `manifest.webmanifest`에 `id`/`scope`가
포함됨을 dev 서버로 직접 확인(`{"id":"/","scope":"/",...}`). `engine.ts`/`prepaid.ts`/
`types.ts`/`recordStore.*`/`migration.ts`/`backup.ts`/`storage.ts`는 `git diff` 기준
완전히 무변경임을 재확인했다. `beforeinstallprompt`/`appinstalled`/설치 후 버튼 숨김은
실제 Android Chrome 환경에서만 트리거되는 브라우저 이벤트라 이 세션(서버 환경, 브라우저
자동화 미연결)에서는 재현할 수 없었다 — 로직은 명세대로 구현했고 실기기 최종 확인이
필요하다.

---

## 1-2. 이전 PWA/브랜딩/배포 준비 기록 (2026-09-13)

**PWA/브랜딩/배포 준비**: settlement/prepaid 계산 엔진, IndexedDB 구조,
migration, backup/restore, 기존 데이터 모델, 정산 계산식은 전혀 수정하지 않았다.
새 정산 기능도 추가하지 않았다. 이번 PART은 순수 PWA 설치 가능 상태 + 기본 브랜딩 +
배포 준비 정리다.

- 앱 이름/설명/색상을 `src/lib/branding.ts` 한 곳에 모았다 — 이름을 바꿀 때 이 파일만
  고치면 metadata/manifest/아이콘에 전부 반영된다. v0.1 이름은 "헤어정산"
  (영문 내부 이름 HairCalc), 설명 "헤어 디자이너를 위한 개인 매출·정산 관리".
- `src/app/manifest.ts` — Next.js App Router의 manifest 파일 컨벤션으로
  `/manifest.webmanifest`를 자동 생성 (`name`/`short_name`/`description`은
  branding.ts 참조, `display: "standalone"`, `start_url: "/"`,
  `theme_color`/`background_color`는 앱 배경(#fafafa)과 통일, `orientation` 강제 없음).
- 아이콘: `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`를
  **프로젝트 내부 스크립트(`scripts/generate-icons.mjs`)로 직접 생성해 정적 파일로
  커밋**했다 (요청받은 방식 — 매 요청마다 렌더링하는 라우트 핸들러 대신 한 번 생성해
  저장소에 둠). 디자인은 zinc-900 배경 + 흰색 굵은 "H" 글자, 복잡한 일러스트나
  헤어샵 모티프 없이 작은 크기에서도 알아보기 쉬운 placeholder다. 브랜드 색/글자를
  바꾸려면 `branding.ts` 수정 후 `node scripts/generate-icons.mjs`만 다시 실행하면
  된다. (처음엔 원화 기호 "₩"를 썼는데 `next/og`가 렌더링을 위해 구글 폰트를
  원격으로 내려받으려다 네트워크 없는 빌드 환경에서 실패해 ASCII "H"로 바꿨다.)
  파비콘(`src/app/icon.tsx`, 32×32)과 iOS용 apple-touch-icon
  (`src/app/apple-icon.tsx`, 180×180)은 Next.js의 동적 아이콘 컨벤션을 그대로 사용
  (같은 디자인을 `src/lib/appIconMark.tsx`로 공유). 기존 create-next-app 기본
  favicon.ico(Next.js 로고)는 새 아이콘과 혼동되지 않도록 삭제했다.
- `metadata`(layout.tsx): title/description을 branding.ts 기준으로 교체,
  `applicationName`, `appleWebApp`(capable/statusBarStyle/title) 추가. `viewport`에
  `themeColor` 추가. 불필요한 OG/SEO 메타데이터는 추가하지 않았다.
- Service Worker: `public/sw.js` — 캐싱 전략 전혀 없이 모든 요청을 네트워크로 그대로
  전달만 하는 최소 구현(install/activate/fetch 이벤트만 처리). IndexedDB 데이터에
  영향을 줄 수 있는 오프라인 캐싱/프리캐시는 v0.1에서 도입하지 않았다. 등록은
  `src/components/ServiceWorkerRegister.tsx`(클라이언트 전용, 등록 실패해도 앱 사용에
  지장 없음)가 담당하며 `layout.tsx`에 마운트했다.
- 데이터 안내: `/settings` "데이터 관리" 섹션 상단에 "데이터는 현재 이 기기에
  저장됩니다. 기기 변경이나 브라우저 데이터 삭제 전에 백업을 권장합니다." 한 줄을
  추가했다 (팝업 아님, 조용한 안내 텍스트).

검증: `npm run lint` / `npm test`(71개 그대로 통과, 로직 무변경) /
`npm run build`(typecheck 포함) 모두 통과. 빌드 라우트에
`/manifest.webmanifest`, `/icon`, `/apple-icon`이 정적으로 추가 생성됨을 확인했고,
`public/icons/*.png`는 별도 라우트 없이 Next.js의 public 정적 서빙으로 처리된다
(SSR/빌드 중 IndexedDB를 참조하는 코드는 전혀 추가하지 않아 서버 환경 오류 없음).
dev 서버(localhost:3000)로 `/`, `/entry`, `/history`, `/settlement`, `/prepaid`,
`/prepaid/new`, `/more`, `/settings`, `/manifest.webmanifest`,
`/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-512-maskable.png`,
`/sw.js` 전부 200 + 올바른 Content-Type(`application/manifest+json`, `image/png`,
`application/javascript`)을 확인했다. `engine.ts`/`prepaid.ts`/`types.ts`/
`recordStore.*`/`migration.ts`/`backup.ts`/`storage.ts`는 `git diff` 기준
완전히 무변경임을 재확인했다.

**남은 배포 단계 (아직 진행하지 않음)**: Vercel 프로젝트 생성/연결, 실제 배포,
배포된 HTTPS 주소에서 Chrome/Android "홈 화면에 추가" 실제 설치 테스트,
실기기에서 standalone 실행 확인. 서버/DB 환경변수는 필요 없음(IndexedDB만 사용).

**모바일 UI/UX 정리 (2026-09-13)**: 계산 엔진(`engine.ts`, `prepaid.ts`), IndexedDB
저장 구조(`recordStore.*`, `migration.ts`, `backup.ts`, `storage.ts`), 데이터 모델
(`types.ts`)은 전혀 수정하지 않았다. UI/UX만 다음과 같이 정리했다.

- 하단 네비게이션을 5개 탭 **홈 / 등록 / 월정산 / 정액권 / 더보기**로 재구성했다.
  기존에는 "정액권 관리"로 가는 길이 `/entry` 화면 안의 텍스트 링크 하나뿐이었는데,
  이번에 탭으로 승격했다. "더보기"는 새 라우트 `/more`(내역·설정으로 가는 목록)이며,
  기존 `/history`, `/settings` 경로는 그대로 두고 진입점만 추가했다 — 6개 탭을
  억지로 넣지 않고 예시(홈/등록/월정산/정액권/더보기) 그대로 채택했다.
- 홈: "이번 달 예상 정산액"(가장 큼) → "이번 달 총매출" → "거래 건수"/"정액권 영향"
  순으로 정보 계층을 명확히 하고, 우선순위 목록에 없던 평균 객단가/평균 정산율
  카드는 제거했다(불필요한 카드 추가 금지 원칙). 거래·정액권 이벤트가 전혀 없으면
  "아직 등록된 매출이 없어요" + [첫 거래 등록] 버튼을 보여준다.
- 거래등록(`/entry`): 금액 입력을 text-3xl로 키우고, "정액권" 결제수단을 고르면
  나오는 영역에 굵은 좌측 보더 + "정액권 결제 · 보유 중인 정액권의 잔액에서
  차감됩니다" 안내를 붙여 정액권 등록과 혼동되지 않게 했다. 예상 정산액/정산 영향
  숫자를 더 크게 강조. 금액 입력에 `min={0}` 추가.
- 정액권 목록(`/prepaid`): 카드에서 가장 먼저 보이는 값을 "잔액"(text-xl font-bold)
  으로 바꾸고 식별명·실결제/사용가능·정산방식은 그 아래 보조 정보로 내렸다.
  "+ 정액권 등록"을 텍스트 링크에서 실제 버튼(검정 pill)으로, 빈 상태에도
  [첫 정액권 등록] CTA를 추가했다.
- 정액권 상세(`/prepaid/[id]`): [환불]/[조정] 버튼과 그 입력 폼·저장 버튼을
  빨간색 계열로 구분해 [정액권 사용]/[타 디자이너 사용]과 혼동되지 않게 했다.
  모든 금액 입력에 `min={0}`.
- 월정산(`/settlement`): 이전달/다음달 버튼과 실제 지급액 저장 버튼의 터치 영역을
  키우고, 달력 셀에 배경/그림자/눌림 효과(`active:bg-zinc-100`)를 줘서 클릭 가능함이
  느껴지게 했다. 셀 텍스트는 `truncate`+9px로 360px에서도 잘리지 않게 했고, 이 달에
  거래가 없으면 "이 달에는 등록된 거래가 없어요" 안내를 추가했다.
- 내역(`/history`): 정산액을 크게 강조(text-lg font-bold)하고 시술유형을 앞으로
  올려 "날짜/시술유형/정산액/금액" 중심으로 재정렬. 빈 상태에 [첫 거래 등록] CTA 추가.
- 설정(`/settings`): 인센티브율/카드수수료율/재료비 비율 등 % 입력에 `min=0 max=100`
  (재료비 고정금액은 `min=0`만) 추가. 저장 시 `format.ts`에 새로 추가한
  `clampNumber`로 모든 비율을 0~100%로 강제 clamp — 음수나 500% 같은 비정상 값이
  그대로 저장되던 문제를 폼 레벨에서 막았다 (계산 엔진은 수정하지 않음). 모든
  입력/버튼에 44px 이상의 터치 영역(`min-h-[44px]`/`[48px]`/`[52px]`) 확보.
- 전 화면 공통: 버튼/입력 터치 영역을 40~52px로 확보, 긴 텍스트 줄에는
  `flex-wrap`/`truncate`/`break-words`/`tabular-nums`를 적용해 360px 폭에서도
  가로 스크롤이나 금액 잘림이 생기지 않도록 방어했다.

검증: `npm run lint` / `npm test`(71개 그대로 통과, 테스트 대상 로직 무변경) /
`npm run build`(typecheck 포함, `/more` 라우트 추가 생성 확인) 모두 통과.
`engine.ts`/`prepaid.ts`/`types.ts`/`recordStore.*`/`migration.ts`/`backup.ts`/
`storage.ts`는 `git diff` 기준 완전히 무변경임을 확인했다.

360/390/430px 반응형 점검은 Claude in Chrome이 이 세션에 연결되어 있지 않아
실제 브라우저 스크린샷으로 확인하지 못했다. 대신 Tailwind 클래스와 실제 콘텐츠
너비를 계산으로 검증했다 — 예: `max-w-md`(448px) 컨테이너 + `px-4`(32px) 여백
기준 360px 화면의 실제 콘텐츠 폭은 328px이고, 월정산 달력(`grid-cols-7`,
`gap-1`)의 셀 폭은 약 43px, 정액권 상세의 액션 버튼(`grid-cols-4`, `gap-2`)은
약 76px로 계산했다 — "타 디자이너 사용"처럼 긴 라벨은 버튼 안에서 두 줄로
자연스럽게 줄바꿈될 뿐 가로 스크롤이나 잘림은 발생하지 않는다(버튼에 `min-h`만
지정하고 고정 height는 주지 않아 grid의 기본 `align-items: stretch`로 4개
버튼 높이가 자동으로 맞춰짐). 실제 기기/DevTools 반응형 모드에서의 최종 확인은
사용자가 직접 진행하는 것을 권장한다 (이미 실제 Chrome에서 수동 테스트를
진행해 온 세션이므로 devtools 반응형 모드 전환만 하면 된다).

저장소를 localStorage에서 IndexedDB로 전환하고, 기존 localStorage 데이터 자동
마이그레이션 + JSON 전체 백업/복원 + 전체 데이터 삭제를 `/settings`에 추가했다.
정산 계산 엔진은 전혀 수정하지 않았다 (자세한 내용은 아래 "NEXT 6" 참고).

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

### NEXT 6 — 저장소 IndexedDB 전환 + 마이그레이션/백업/복원/전체삭제 (완료)

localStorage 기반 저장을 IndexedDB로 전환했다. 정산 계산 엔진(`engine.ts`, `prepaid.ts`)은
전혀 수정하지 않았고, `storage.ts`의 공개 함수 이름/역할은 그대로 유지한 채 전부
동기 → 비동기로 바꿨다 (UI는 여전히 `storage.ts`만 알고 IndexedDB 구현을 모른다).

**저장 계층 구조 (레코드 단위 저장)**
- `src/lib/settlement/recordStore.ts` — 저장소 추상 인터페이스(`RecordStore`)와
  store 이름(`settings`/`transactions`/`prepaidPasses`/`prepaidEvents`/
  `monthlyActualPayouts`/`meta`) 정의. Transaction/PrepaidPass/PrepaidEvent는
  레코드(문서) 단위로 저장되어, 하나 추가/수정할 때 배열 전체를 다시 쓰지 않는다.
- `src/lib/settlement/recordStore.indexeddb.ts` — 실제 브라우저 구현 (IndexedDB).
  SSR에서는 절대 호출되지 않는다 (storage.ts가 `isBrowser()`로 먼저 막는다).
- `src/lib/settlement/recordStore.memory.ts` — 테스트 전용 메모리 구현.
  Node에는 IndexedDB가 없어서, migration.ts/backup.ts 로직을 이 메모리 구현으로
  실제 IndexedDB 없이도 완전히 테스트할 수 있게 만들었다 (새 라이브러리 추가 없이 해결).
- `src/lib/settlement/migration.ts` — legacy localStorage(v1) → IndexedDB 자동 이전.
- `src/lib/settlement/backup.ts` — JSON 전체 백업/복원.
- `src/lib/settlement/storage.ts` — 위 세 파일을 조합한 공개 API (UI가 보는 유일한 창).

**자동 마이그레이션 규칙**
1. IndexedDB가 비어있고 legacy localStorage에 데이터가 있을 때만 복사한다.
2. 복사 후 반드시 검증(개수 + snapshot 값 완전 일치)하고, 실패하면 완료 플래그를
   남기지 않는다 (다음 로드에서 재시도 가능, legacy 데이터도 건드리지 않으므로 안전).
3. 완료 플래그(IndexedDB의 `meta` store)가 있거나 IndexedDB에 이미 데이터가 있으면
   항상 아무 것도 하지 않는다 — 여러 번 실행해도 중복 생성/덮어쓰기가 없다.
4. v0.1 원칙대로 마이그레이션 성공 후에도 legacy localStorage는 즉시 삭제하지 않는다
   (데이터 유실 방지 우선). legacy 삭제는 "모든 데이터 삭제" 기능에서만 일어난다.

**`/settings`에 데이터 관리 영역 추가**
- [백업 파일 내보내기]: 전체 데이터를 `haircalc-backup-YYYY-MM-DD.json` 파일로 다운로드.
  포맷: `{backupVersion, schemaVersion, exportedAt, settings, transactions,
  prepaidPasses, prepaidEvents, monthlyActualPayouts}`.
- [백업 파일에서 복원]: JSON 파싱 실패/구조 불일치/미래 버전(backupVersion·schemaVersion이
  현재보다 높음)을 모두 `validateBackup`으로 차단. 통과해도 `window.confirm`으로 한 번 더
  확인 후 전체 교체 복원만 수행 (병합 복원 없음 — 기존 데이터는 복원 전 전부 지운다).
- [모든 데이터 삭제]: `window.confirm` 확인 후 IndexedDB 전체 + 마이그레이션 플래그 +
  legacy localStorage까지 전부 삭제. 삭제 후 정산 설정은 기본값으로 정상 시작된다.

**테스트**: 기존 57개(engine 16 + month 9 + summary 7 + prepaid 21 + prepaid-integration 4)는
그대로 유지. localStorage 동기 API에 직접 의존하던 `prepaid-storage.test.ts`는 저장 계층이
비동기/IndexedDB로 바뀌면서 그대로 쓸 수 없어 제거하고, 같은 취지(저장 후 재조회 시 동일)를
더 폭넓게 검증하는 `migration.test.ts`(7개) + `backup.test.ts`(7개)로 대체했다.
합계 `npm test` **71개, 전부 통과** (57 + 7 + 7).

지정된 A~J 시나리오 매핑:
- A(빈 IndexedDB 초기화), D(2회 실행해도 중복 없음), E(기존 IndexedDB 데이터가
  legacy로 덮어써지지 않음), J(전체 삭제 정상) → `migration.test.ts`
- B/C(legacy 데이터 → migration → 동일 데이터/snapshot 완전 일치) → `migration.test.ts`
- F(export 전체 포함), G(export → 삭제 → restore → 완전 복구, 병합 아님 확인),
  H(잘못된 JSON 차단), I(지원하지 않는 version 차단) → `backup.test.ts`

**실사용 시나리오 검증 (섹션 10, 실제 숫자)**: Node에는 IndexedDB가 없어, 이 스크립트
안에서만 쓰는 최소 가짜 IndexedDB(open/transaction/objectStore get·getAll·put·delete·clear,
실제와 동일하게 비동기 이벤트로 동작)를 만들어 `storage.ts`/`migration.ts`/`backup.ts`/
`recordStore.indexeddb.ts` 실제 코드를 그대로 실행해 검증했다 (memory store를 쓰는
단위테스트와 별개로, 진짜 IndexedDB 어댑터 코드 경로까지 확인한 것). 시나리오:
일반 거래 3건(30만/15만/8만원) + SALE_IMMEDIATE 정액권 등록(100만) 후 본인 사용 20만
(SALE_IMMEDIATE라 영향 0) → 타 디자이너 사용 10만(-10만 매출/-4만 정산) → 환불 5만
(-5만 매출/-2만 정산)까지 legacy localStorage(v1) 형식으로 미리 채워두고:
1. migration 전 수기 계산 총매출 1,380,000 / 정산 552,000 / 정액권 잔액 650,000
2. `loadTransactions()` 등 첫 호출 시 자동 migration → IndexedDB 거래 3건/정액권 1건/
   이벤트 4건 확인
3. migration 후 이번 달 합계 총매출 1,380,000 / 정산 552,000 → **1과 완전 일치**
4. 정액권 잔액 650,000 → **일치**, 설정 인센티브율 0.4 snapshot 유지 확인
5. 새로고침(재조회) 후 거래 수 동일
6. JSON backup → transactions 3 / prepaidPasses 1 / prepaidEvents 4 /
   monthlyActualPayouts 1, `validateBackup` 통과
7. 전체 데이터 삭제 → 거래 0 / 정액권 0 / 설정 기본값(40%) 복귀
8. JSON 파일을 실제 저장/로드하듯 JSON 왕복(stringify→parse) 후 복원
9. 복원 후 거래 3건 / 정액권 잔액 650,000 / 이번 달 합계 1,380,000·552,000 /
   인센티브율 0.4 → **migration 직후와 완전히 동일**

dev 서버로 `/`, `/entry`, `/history`, `/settings`, `/settlement`, `/settlement/2026-09-12`,
`/prepaid`, `/prepaid/new` 전부 200 확인. `/settings`는 IndexedDB 읽기가 클라이언트에서만
가능해 SSR 시 "불러오는 중..."만 보이는 것이 기존 다른 화면들과 동일한 정상 패턴임을 확인.
Claude in Chrome이 연결되어 있지 않아 실제 브라우저 클릭 조작 테스트는 하지 못했다.

### NEXT 6.5 — 모바일 UI/UX 정리 (완료)
- [x] 하단 네비게이션 재구성 (홈/등록/월정산/정액권/더보기, `/more` 신규 라우트)
- [x] 홈 정보 우선순위 정리 + 빈 상태
- [x] 거래등록 정액권 결제 구역 시각적 구분 + 금액 강조
- [x] 정액권 목록/상세 정보 우선순위 정리 + 위험 액션(환불/조정) 색상 구분
- [x] 월정산 달력 터치 어포던스 + 빈 상태
- [x] 내역 정보 우선순위 정리 + 빈 상태
- [x] 설정 입력 방어(clamp, min/max) + 터치 영역 확보
- [x] 전 화면 터치 타깃(40~52px) + 360px 텍스트 overflow 방어

자세한 내용은 위 "1. 현재 상태"의 "모바일 UI/UX 정리 (2026-09-13)" 참고.
계산 엔진/IndexedDB 구조/데이터 모델은 이 작업에서 전혀 수정하지 않았다.

### NEXT 7 — 모바일 실사용 테스트
실제 휴대폰에서:
- 거래 등록
- 월 합계
- 달력
- 정액권
- 새로고침 후 데이터 유지
확인 (이번 UI 정리가 반영된 상태 기준으로 재확인 권장)

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
