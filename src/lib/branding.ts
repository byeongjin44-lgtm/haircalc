// 앱 이름/설명/브랜드 색상의 단일 출처. metadata, manifest, 아이콘이 전부 이 값을 참조한다.
// 나중에 이름/색상을 바꿀 때 이 파일만 수정하면 되도록, 다른 파일에 문자열을 하드코딩하지 않는다.

/** v0.1 작업명 (한글, 화면에 노출되는 이름). */
export const APP_NAME = "헤어정산";

/** 영문 내부 이름 (패키지/코드 상 참조용, 화면 노출용 아님). */
export const APP_NAME_EN = "HairCalc";

export const APP_DESCRIPTION = "헤어 디자이너를 위한 개인 매출·정산 관리";

/** 현재 앱 배경(bg-zinc-50)과 맞춘 밝고 중립적인 PWA 테마 색상. */
export const APP_THEME_COLOR = "#fafafa";
export const APP_BACKGROUND_COLOR = "#fafafa";

/** 아이콘 배경/전경색. 버튼에 쓰는 zinc-900과 통일한다. */
export const APP_ICON_BACKGROUND_COLOR = "#18181b";
export const APP_ICON_FOREGROUND_COLOR = "#ffffff";

/**
 * 단순 placeholder 아이콘 글자. 나중에 실제 브랜드 아이콘으로 교체하기 전까지 사용한다.
 * ASCII 글자만 쓴다 — 원화 기호(₩)나 한글은 next/og가 렌더링 시 구글 폰트를 원격으로
 * 내려받으려 시도하다 네트워크가 없는 빌드 환경에서 실패했다(HairCalc의 H로 대체).
 */
export const APP_ICON_GLYPH = "H";
