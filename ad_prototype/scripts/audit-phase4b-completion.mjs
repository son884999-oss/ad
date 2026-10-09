import { readFile, writeFile, mkdir, readdir } from "node:fs/promises"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
const root = new URL("../", import.meta.url)
const checkpoint = new URL("../.phase4b-checkpoint-20261009/", root)
const digest = (data) => createHash("sha256").update(data).digest("hex")
const baseline = JSON.parse(
  await readFile(new URL("baseline.json", checkpoint), "utf8"),
)
const changed = []
for (const file of baseline) {
  assert.equal(
    digest(await readFile(new URL("files/" + file.file, checkpoint))),
    file.sha256,
    "복원 사본 일치",
  )
  if (digest(await readFile(new URL(file.file, root))) !== file.sha256)
    changed.push(file.file)
}
for (const file of [
  "src/StepProgress.tsx",
  "src/FeedbackProvider.tsx",
  "src/FeedbackSettings.tsx",
  "src/channels.ts",
  "src/canvasText.ts",
  "package.json",
  "vite.config.ts",
  "AGENTS.md",
])
  assert(!changed.includes(file), `기존 계약·지침 변경: ${file}`)
assert(
  !changed.some(
    (file) =>
      file.startsWith("public/assets/illustrations/") ||
      file.startsWith("public/assets/branding/concepts/"),
  ),
  "기존 에셋 삭제·덮어쓰기 없음",
)
const assetManifest = JSON.parse(
  await readFile(
    new URL("public/assets/illustrations/phase4b/asset-manifest.json", root),
    "utf8",
  ),
)
const checks = JSON.parse(
  await readFile(
    new URL("ui-review/phase4b-final/verification.json", root),
    "utf8",
  ),
)
assert.equal(assetManifest.distinctCreativeCount, 20)
assert.equal(checks.integration.length, 12)
assert.equal(checks.screens.length, 42)
assert(
  checks.screens.every(
    (screen) => !screen.overflow && screen.missing.length === 0,
  ),
)
assert.equal(checks.clarity.length, 7)
for (const check of checks.clarity)
  assert(
    check.reading.y < check.guide.y &&
      check.guide.y < check.example.y &&
      check.descriptionInput.y < 700 &&
      check.uploadAction.visible,
    "시니어 우선 시각 위계",
  )
const artifacts = []
for (const asset of assetManifest.assets) {
  if (asset.category === "illustration") {
    assert.equal(
      digest(await readFile(new URL(asset.original, root))),
      asset.sourceSha256,
    )
    await readFile(
      new URL(
        `design-assets/illustrations/phase4b/${
          asset.creativeId === "service-hero"
            ? "service-hero-edit"
            : asset.creativeId
        }.prompt.txt`,
        root,
      ),
    )
    for (const file of asset.files)
      assert.equal(
        (
          await readFile(
            new URL(
              "public/assets/illustrations/phase4b/" + file.filename,
              root,
            ),
          )
        ).length,
        file.bytes,
      )
  } else
    assert.equal(
      digest(await readFile(new URL(asset.file, root))),
      asset.sourceSha256,
    )
  artifacts.push(asset.creativeId)
}
const src = (
  await Promise.all(
    (
      await readdir(new URL("src/", root))
    )
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .map((file) => readFile(new URL("src/" + file, root), "utf8")),
  )
).join("\n")
const decorativeEmoji = [...src.matchAll(/[\u{1F300}-\u{1FAFF}]/gu)].map(
  (match) => match[0],
)
const report = {
  restoreCopiesVerified: baseline.length,
  changedExistingFiles: changed.filter(
    (file) => !["DESIGN_MASTER.md", "HASE4B_MASTER.md"].includes(file),
  ),
  externalInstructionChanges: changed.filter((file) =>
    ["DESIGN_MASTER.md", "HASE4B_MASTER.md"].includes(file),
  ),
  updatedMasterReviewed: (
    await readFile(new URL("HASE4B_MASTER.md", root), "utf8")
  ).includes("ABSOLUTE PRIORITY"),
  preservedCore: true,
  originalAssetsPreserved: true,
  distinctAssets: artifacts,
  actualIllustrationIntegration: 12,
  renderedScreenChecks: checks.screens.length,
  seniorHierarchy: checks.clarity,
  threeSecondHeuristicNotExperiment: true,
  decorativeEmoji,
  evidenceReport: "PHASE4B_FINAL_REPORT.md",
}
await mkdir(new URL("ui-review/phase4b-final/", root), { recursive: true })
await writeFile(
  new URL("ui-review/phase4b-final/completion-audit.json", root),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
