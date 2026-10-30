// Photo-review API/UI verification follows the mandatory pre-background flow (2026-10-30).
import assert from "node:assert/strict"
import { parsePhotoReview as parseServerReview, PHOTO_RESPONSE_SCHEMA } from "../api/_lib/photo.js"
import { parsePhotoReview, reviewWithQuality } from "../src/photoReview.ts"
const check = async (name, fn) => { await fn(); console.log("PASS", name) }
await check("API + browser reject unknown, object, inherited and duplicate categories", () => {
  for (const parse of [parseServerReview, parsePhotoReview]) {
    for (const invalid of [null, [], "x", { items: null }, { items: [{ category: { toString: "person" } }, { category: "__proto__" }, { category: "unknown" }] }]) assert.deepEqual(parse(invalid), { items: [], uncertain: false })
    const result = parse({ items: [{ category: "person", reason: "가".repeat(150) }, { category: "person", reason: "중복" }, ...["animal", "building", "alcohol", "credit_card"].map(category => ({ category, reason: "확인" }))], uncertain: "true" })
    assert.equal(result.items.length, 4); assert.equal(result.items[0].reason.length, 100); assert.equal(result.uncertain, false)
  }
  assert.ok(PHOTO_RESPONSE_SCHEMA.required.includes("photoReview"))
  assert.equal(reviewWithQuality({ items: [{ category: "blurry", reason: "확인" }] }, { isRealPhoto: true, isBlurry: true, reason: "흐림" }).items.length, 1)
})
if (process.env.PHOTO_REVIEW_UNIT_ONLY === "1") process.exit(0)

await import("./verify-photo-review-default.mjs")
