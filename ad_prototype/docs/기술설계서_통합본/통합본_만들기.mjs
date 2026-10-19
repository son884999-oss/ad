// Builds docs/기술설계서_통합본/기술설계서_통합본.html from the shared 기술문서 (structure + cost) and the tech-stack sheets.
import { readFileSync, writeFileSync } from "node:fs"
const root = process.argv[2]
const team = readFileSync(`${root}/docs/기술문서/기술문서.html`, "utf8")
const prof = readFileSync(`${root}/docs/기술설계서_통합본/기술스택_상세설명서.html`, "utf8")
const css = (html) => html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"))
const sheets = (html) => [...html.matchAll(/<section class="sheet"[\s\S]*?<\/section>/g)].map((m) => m[0])
const [structure, cost] = sheets(team)
const stack = sheets(prof)
const extra = readFileSync(`${root}/docs/기술설계서_통합본/6_배경변환_제안.html`, "utf8")
const titles = ["2. 기술 스택 ① 화면, 입력, 사진·포스터 처리", "3. 기술 스택 ② 영상과 음향 처리", "4. 기술 스택 ③ 서버, AI, 회원·저장, 품질 검증"]
const page = (html, n, title) => html
  .replace(/data-file="[^"]*"/, `data-file="${n}"`)
  .replace(/<h1><span>홍보잇다<\/span>[^<]*<\/h1>/, `<h1><span>홍보잇다</span> 기술 설계서 · ${title}</h1>`)
  .replace(/<b>\d \/ \d<\/b>/, `<b>${n} / 6</b>`)
const body = [
  page(structure, 1, "1. 시스템 통합 구조도"),
  ...stack.map((s, i) => page(s.replace(/<span class="tag [a-z]+">[^<]*<\/span>/g, "").replace(/<p class="legend">[\s\S]*?<\/p>/, ""), i + 2, titles[i])),
  page(cost, 5, "5. 단계별 비용"),
  extra,
].join("\n\n")
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>홍보잇다 기술 설계서</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<style>
  /* 홍보잇다 기술 설계서 통합본 (교수님 제출용), 2026-10-19. Six A4-landscape sheets. Built from docs/기술문서/기술문서.html
     and 기술스택_상세설명서.html; render: node scripts/render-tech-doc.mjs docs/기술설계서_통합본/기술설계서_통합본.html */
${css(team)}
  /* tech-stack sheets */
${css(prof)}
  .cost { table-layout: auto; }
  .cost td, .cost th { font-size: inherit; }
  .cost td { font-size: 18px; padding: 11px 12px; }
  .cost th { font-size: 14.5px; }
  header { margin-bottom: 18px; }
</style>
</head>
<body>

${body}

</body>
</html>
`
writeFileSync(`${root}/docs/기술설계서_통합본/기술설계서_통합본.html`, html)
console.log("sheets", body.match(/class="sheet"/g).length)
