/// <reference lib="es2022.intl" />
/** Wrap Korean and unspaced product names using actual font metrics. */
export function wrapCanvasText(
  context: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  if (maxWidth <= 0 || maxLines <= 0) return []
  const characters = Array.from(
    new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text.trim()),
    (item) => item.segment,
  )
  const lines: string[] = []
  let line = ""
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index]
    if (
      character !== "\n" &&
      context.measureText(line + character).width <= maxWidth
    ) {
      line += character
      continue
    }
    lines.push(line.trimEnd())
    if (lines.length === maxLines) {
      if (characters.slice(index).join("").trim()) {
        const tail = Array.from(
          new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(
            lines.pop() ?? "",
          ),
          (item) => item.segment,
        )
        while (
          tail.length &&
          context.measureText(tail.join("") + "…").width > maxWidth
        )
          tail.pop()
        lines.push(
          context.measureText("…").width <= maxWidth ? tail.join("") + "…" : "",
        )
      }
      return lines
    }
    line = character === "\n" ? "" : character.trimStart()
  }
  if (line) lines.push(line.trimEnd())
  return lines
}
