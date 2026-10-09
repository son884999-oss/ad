import { chromium } from "playwright"
import { readFile, writeFile, mkdir, access } from "node:fs/promises"
import { createHash } from "node:crypto"
const root = new URL("../", import.meta.url)
const original = new URL("design-assets/illustrations/phase4b/", root)
const target = new URL("public/assets/illustrations/phase4b/", root)
await mkdir(target, { recursive: true })
const illustrationPlan = [
  ["service-hero", "홈 대표 장면", ".studio-hero-art", true],
  ["service-poster", "홈 이미지 만들기", ".studio-shortcuts", false],
  ["service-video", "홈 동영상 만들기", ".studio-shortcuts", false],
  ["service-copy", "홈 홍보 글 만들기", ".studio-shortcuts", false],
  [
    "workflow-photo",
    "홈 1단계·사진 업로드",
    ".studio-guide-steps,.upload-target",
    false,
  ],
  [
    "workflow-details",
    "홈 2단계 설명 안내",
    ".studio-guide-steps",
    false,
  ],
  ["workflow-results", "홈 3단계", ".studio-guide-steps", false],
  ["workflow-channel", "선택 사항인 홍보할 곳 안내", ".channel-intro", true],
  ["records-empty", "내 홍보물 빈 상태", ".empty-results", true],
  ["guide-save", "결과 저장 후 수동 게시 안내", ".publishing-guide", false],
  ["guide-copy", "홍보 글 복사 안내", ".copy-art-guide", false],
  ["result-complete", "준비된 결과 요약", ".result-summary", false],
]
const brands = [
  ["horizontal.svg", "기본 가로 조합", "헤더·전체 메뉴"],
  ["primary-stacked.svg", "세로 기본 조합", "로그인"],
  ["wordmark.svg", "한글 워드마크", "푸터"],
  ["symbol.svg", "컬러 심볼", "브랜드 사용 기준"],
  ["symbol-mono.svg", "남색 단색 심볼", "단색 매체·브랜드 사용 기준"],
  ["symbol-reverse.svg", "반전 단색 심볼", "어두운 매체·브랜드 사용 기준"],
  ["horizontal-reverse.svg", "반전 가로 조합", "어두운 매체·브랜드 사용 기준"],
  ["icon.svg", "정사각 앱 아이콘", "favicon·홈 화면 저장"],
]
const report = []
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
  const page = await browser.newPage()
  for (const [id, purpose, selector, landscape] of illustrationPlan) {
    const source = new URL(id + ".png", original)
    try {
      await access(source)
    } catch (error) {
      if (process.argv.includes("--available")) continue
      throw error
    }
    const bytes = await readFile(source)
    const files = []
    for (const width of id === "service-hero"
      ? [960, 640]
      : [landscape ? 640 : 480]) {
      const encoded = await page.evaluate(
        async ({ data, width, landscape, hero }) => {
          const image = new Image()
          image.src = "data:image/png;base64," + data
          await image.decode()
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = landscape ? Math.round((width * 2) / 3) : width
          const ctx = canvas.getContext("2d")
          if (hero) {
            ctx.fillStyle = "#FFF8EF"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
          const scale = Math.min(
            canvas.width / image.width,
            canvas.height / image.height,
          )
          ctx.drawImage(
            image,
            (canvas.width - image.width * scale) / 2,
            (canvas.height - image.height * scale) / 2,
            image.width * scale,
            image.height * scale,
          )
          const pixels = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data
          let transparentPixels = 0
          for (let i = 3; i < pixels.length; i += 4)
            if (pixels[i] < 250) transparentPixels++
          return {
            data: canvas.toDataURL("image/webp", 0.9).split(",")[1],
            width: canvas.width,
            height: canvas.height,
            alphaCorner: pixels[3],
            alphaShare: transparentPixels / (canvas.width * canvas.height),
            originalWidth: image.width,
            originalHeight: image.height,
          }
        },
        {
          data: bytes.toString("base64"),
          width,
          landscape,
          hero: id === "service-hero",
        },
      )
      const filename =
        id + (id === "service-hero" && width === 640 ? "-640" : "") + ".webp"
      const encodedBytes = Buffer.from(encoded.data, "base64")
      await writeFile(new URL(filename, target), encodedBytes)
      files.push({
        filename,
        width: encoded.width,
        height: encoded.height,
        bytes: encodedBytes.length,
        alphaCorner: encoded.alphaCorner,
        alphaShare: Number(encoded.alphaShare.toFixed(3)),
      })
    }
    report.push({
      creativeId: id,
      category: "illustration",
      purpose,
      selector,
      original: `design-assets/illustrations/phase4b/${id}.png`,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      files,
      integration: "React ServiceArt",
      creation: "내장 image_gen 원본 · 크기/포맷 최적화",
      count: 1,
    })
  }
  for (const [filename, purpose, screen] of brands) {
    const data = await readFile(
      new URL("public/assets/branding/selected/" + filename, root),
    )
    report.push({
      creativeId: filename.replace(".svg", ""),
      category: "branding",
      purpose,
      screen,
      file: "public/assets/branding/selected/" + filename,
      bytes: data.length,
      sourceSha256: createHash("sha256").update(data).digest("hex"),
      integration: screen,
      creation: "승인 C안 기반 SVG 구성",
      count: 1,
    })
  }
  await writeFile(
    new URL("asset-manifest.json", target),
    JSON.stringify(
      {
        distinctCreativeCount: report.length,
        resizeCounted: false,
        assets: report,
      },
      null,
      2,
    ) + "\n",
  )
  console.log(`${report.length}개 창작 단위 저장 (크기·포맷 중복 제외)`)
} finally {
  await browser.close()
}
