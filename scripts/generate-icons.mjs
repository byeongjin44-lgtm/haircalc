// PWA manifest용 placeholder 아이콘을 프로젝트 내부(public/icons)에 정적 파일로 생성한다.
// next/og의 ImageResponse를 그대로 재사용하되, 요청마다 렌더링하는 라우트 핸들러 대신
// 빌드와 무관하게 한 번 실행해 결과 PNG를 저장소에 커밋해두는 방식이다.
// 브랜드 아이콘 색상/글자를 바꾸려면 src/lib/branding.ts만 수정하고 다시 실행하면 된다.
//
// 실행: node scripts/generate-icons.mjs

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { ImageResponse } from "next/og.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "public", "icons");

const ICON_BACKGROUND_COLOR = "#18181b";
const ICON_FOREGROUND_COLOR = "#ffffff";
const ICON_GLYPH = "H";

function markElement(size) {
  return React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_BACKGROUND_COLOR,
      },
    },
    React.createElement(
      "span",
      {
        style: {
          color: ICON_FOREGROUND_COLOR,
          fontSize: Math.round(size * 0.45),
          fontWeight: 700,
        },
      },
      ICON_GLYPH
    )
  );
}

async function generate(size, filename) {
  const response = new ImageResponse(markElement(size), { width: size, height: size });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(outDir, filename), buffer);
  console.log(`wrote public/icons/${filename} (${buffer.length} bytes)`);
}

await mkdir(outDir, { recursive: true });
await generate(192, "icon-192.png");
await generate(512, "icon-512.png");
await generate(512, "icon-512-maskable.png");
