import {
  APP_ICON_BACKGROUND_COLOR,
  APP_ICON_FOREGROUND_COLOR,
  APP_ICON_GLYPH,
} from "./branding";

/**
 * PWA/파비콘/apple-touch-icon 라우트가 공유하는 아이콘 마크.
 * 단순 글자형 placeholder — 복잡한 일러스트 없이 작은 크기에서도 알아보기 쉽게 유지한다.
 * 글자를 캔버스 대비 작게(≈45%) 그려 Android maskable 아이콘의 안전 영역을 넘지 않게 한다.
 * 나중에 실제 브랜드 아이콘으로 바꿀 때 이 컴포넌트만 교체하면 된다.
 */
export function AppIconMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: APP_ICON_BACKGROUND_COLOR,
      }}
    >
      <span
        style={{
          color: APP_ICON_FOREGROUND_COLOR,
          fontSize: Math.round(size * 0.45),
          fontWeight: 700,
        }}
      >
        {APP_ICON_GLYPH}
      </span>
    </div>
  );
}
