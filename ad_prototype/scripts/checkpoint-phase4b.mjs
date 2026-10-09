import {
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
  access,
} from "node:fs/promises"
import { createHash } from "node:crypto"
const root = new URL("../", import.meta.url)
const name = process.argv[2] || ".phase4b-checkpoint-20261009"
if (!/^\.phase4b-[a-z0-9-]+$/.test(name))
  throw Error("복원 폴더 이름 확인 필요")
const dest = new URL(`../${name}/files/`, root)
const marker = new URL("../baseline.json", dest)
let exists = false
try {
  await access(marker)
  exists = true
} catch {}
if (exists)
  throw Error("기존 복원 지점은 덮어쓰지 않습니다. 새 폴더 이름을 지정하세요.")
await mkdir(dest, { recursive: true })
const files = []
async function visit(relative) {
  for (const entry of await readdir(new URL(relative, root), {
    withFileTypes: true,
  })) {
    const file = relative + entry.name
    if (entry.isDirectory()) await visit(file + "/")
    else files.push(file)
  }
}
for (const dir of ["src/", "public/", "scripts/"]) await visit(dir)
files.push(
  ...(await readdir(root)).filter((file) => /^PHASE4.*\.md$/.test(file)),
)
files.push(
  "index.html",
  "package.json",
  "vite.config.ts",
  "AGENTS.md",
  "DESIGN_MASTER.md",
  "HASE4B_MASTER.md",
)
const manifest = []
for (const file of files) {
  await cp(new URL(file, root), new URL(file, dest), { recursive: true })
  const sha256 = createHash("sha256")
    .update(await readFile(new URL(file, root)))
    .digest("hex")
  if (
    createHash("sha256")
      .update(await readFile(new URL(file, dest)))
      .digest("hex") !== sha256
  )
    throw Error(`복원 사본 검증 실패: ${file}`)
  manifest.push({ file, sha256 })
}
await writeFile(
  new URL("../baseline.json", dest),
  JSON.stringify(manifest, null, 2),
)
console.log(`복원 파일 ${manifest.length}개와 SHA-256 기준 저장`)
