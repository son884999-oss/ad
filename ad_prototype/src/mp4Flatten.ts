// Turns the fragmented MP4 that MediaRecorder writes (moov with an empty sample table and duration 0, then
// moof + mdat pieces) into a plain MP4 with a full sample table and the real duration. No re-encoding.
// Why: KakaoTalk read only the first fragment of our 6 s videos and posted 3 s (2026-10-19); players that need
// the duration up front (some messengers, galleries) behave the same.
// Returns null when the file is not fragmented or cannot be read; the caller then keeps the original.

type Box = { type: string; start: number; size: number; header: number }
type Sample = { offset: number; size: number; duration: number; sync: boolean; cto: number }
type Track = { id: number; trak: Box; timescale: number; isVideo: boolean; samples: Sample[]; chunks: number[][] }
type Trex = { duration: number; size: number; flags: number }

function boxes(view: DataView, start: number, end: number): Box[] {
  const list: Box[] = []
  let at = start
  while (at + 8 <= end) {
    let size = view.getUint32(at)
    let header = 8
    if (size === 1) {
      size = Number(view.getBigUint64(at + 8))
      header = 16
    } else if (size === 0) size = end - at
    if (size < header || at + size > end) break
    const type = String.fromCharCode(view.getUint8(at + 4), view.getUint8(at + 5), view.getUint8(at + 6), view.getUint8(at + 7))
    list.push({ type, start: at, size, header })
    at += size
  }
  return list
}
const child = (view: DataView, box: Box, type: string, skip = 0) => boxes(view, box.start + box.header + skip, box.start + box.size).find((b) => b.type === type)
const children = (view: DataView, box: Box, skip = 0) => boxes(view, box.start + box.header + skip, box.start + box.size)

// --- writing -------------------------------------------------------------------------------------------------
class Writer {
  parts: Uint8Array[] = []
  length = 0
  push(bytes: Uint8Array) {
    this.parts.push(bytes)
    this.length += bytes.length
  }
  u32(...values: number[]) {
    const bytes = new Uint8Array(values.length * 4)
    const view = new DataView(bytes.buffer)
    values.forEach((value, i) => view.setUint32(i * 4, value >>> 0))
    this.push(bytes)
  }
  i32(value: number) {
    const bytes = new Uint8Array(4)
    new DataView(bytes.buffer).setInt32(0, value)
    this.push(bytes)
  }
  bytes() {
    const out = new Uint8Array(this.length)
    let at = 0
    for (const part of this.parts) {
      out.set(part, at)
      at += part.length
    }
    return out
  }
}
function box(type: string, ...content: Uint8Array[]) {
  const size = 8 + content.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  view.setUint32(0, size)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  let at = 8
  for (const part of content) {
    out.set(part, at)
    at += part.length
  }
  return out
}
function fullBox(type: string, version: number, write: (w: Writer) => void) {
  const w = new Writer()
  w.u32(((version & 0xff) << 24) >>> 0)
  write(w)
  return box(type, w.bytes())
}
/** Run-length pairs: [count, value] for consecutive equal values. */
function runs(values: number[]) {
  const out: [number, number][] = []
  for (const value of values) {
    const last = out[out.length - 1]
    if (last && last[1] === value) last[0] += 1
    else out.push([1, value])
  }
  return out
}

/** Copies a full box and overwrites its duration field (mvhd, tkhd and mdhd share the layout rules below). */
function withDuration(source: Uint8Array, view: DataView, b: Box, duration: number) {
  const copy = source.slice(b.start, b.start + b.size)
  const out = new DataView(copy.buffer)
  const version = view.getUint8(b.start + b.header)
  const body = b.header + 4
  // mvhd / mdhd: created, modified, timescale, duration. tkhd: created, modified, track id, reserved, duration.
  const isTkhd = b.type === "tkhd"
  if (version === 1) {
    const at = body + 16 + (isTkhd ? 8 : 4)
    out.setBigUint64(at, BigInt(Math.round(duration)))
  } else {
    const at = body + 8 + (isTkhd ? 8 : 4)
    out.setUint32(at, Math.min(0xffffffff, Math.round(duration)))
  }
  return copy
}

export function flattenMp4(input: ArrayBuffer): Uint8Array<ArrayBuffer> | null {
  try {
    const source = new Uint8Array(input)
    const view = new DataView(input)
    const top = boxes(view, 0, source.length)
    const moov = top.find((b) => b.type === "moov")
    const moofs = top.filter((b) => b.type === "moof")
    if (!moov || !moofs.length || !child(view, moov, "mvex")) return null
    const mvhd = child(view, moov, "mvhd")
    if (!mvhd) return null
    const mvhdVersion = view.getUint8(mvhd.start + mvhd.header)
    const movieTimescale = view.getUint32(mvhd.start + mvhd.header + 4 + (mvhdVersion === 1 ? 16 : 8))

    // Tracks and their defaults (trex).
    const trex = new Map<number, Trex>()
    for (const b of children(view, child(view, moov, "mvex")!)) {
      if (b.type !== "trex") continue
      const at = b.start + b.header + 4
      trex.set(view.getUint32(at), { duration: view.getUint32(at + 8), size: view.getUint32(at + 12), flags: view.getUint32(at + 16) })
    }
    const tracks = new Map<number, Track>()
    for (const trak of children(view, moov).filter((b) => b.type === "trak")) {
      const tkhd = child(view, trak, "tkhd")
      const mdia = child(view, trak, "mdia")
      const mdhd = mdia && child(view, mdia, "mdhd")
      const hdlr = mdia && child(view, mdia, "hdlr")
      if (!tkhd || !mdhd || !hdlr) return null
      const id = view.getUint32(tkhd.start + tkhd.header + 4 + (view.getUint8(tkhd.start + tkhd.header) === 1 ? 16 : 8))
      const mdhdVersion = view.getUint8(mdhd.start + mdhd.header)
      const timescale = view.getUint32(mdhd.start + mdhd.header + 4 + (mdhdVersion === 1 ? 16 : 8))
      const handler = String.fromCharCode(...source.slice(hdlr.start + hdlr.header + 8, hdlr.start + hdlr.header + 12))
      tracks.set(id, { id, trak, timescale, isVideo: handler === "vide", samples: [], chunks: [] })
    }

    // Samples from every moof/traf/trun, in file order (one chunk per trun).
    const order: { track: Track; chunk: number }[] = []
    for (const moof of moofs) {
      for (const traf of children(view, moof).filter((b) => b.type === "traf")) {
        const tfhd = child(view, traf, "tfhd")
        if (!tfhd) return null
        const tfFlags = view.getUint32(tfhd.start + tfhd.header) & 0xffffff
        let at = tfhd.start + tfhd.header + 4
        const track = tracks.get(view.getUint32(at))
        if (!track) return null
        at += 4
        const defaults = { ...(trex.get(track.id) ?? { duration: 0, size: 0, flags: 0 }) }
        let base = moof.start
        if (tfFlags & 0x1) {
          base = Number(view.getBigUint64(at))
          at += 8
        }
        if (tfFlags & 0x2) at += 4
        if (tfFlags & 0x8) {
          defaults.duration = view.getUint32(at)
          at += 4
        }
        if (tfFlags & 0x10) {
          defaults.size = view.getUint32(at)
          at += 4
        }
        if (tfFlags & 0x20) defaults.flags = view.getUint32(at)
        for (const trun of children(view, traf).filter((b) => b.type === "trun")) {
          const version = view.getUint8(trun.start + trun.header)
          const flags = view.getUint32(trun.start + trun.header) & 0xffffff
          let p = trun.start + trun.header + 4
          const count = view.getUint32(p)
          p += 4
          let offset = base
          if (flags & 0x1) {
            offset = base + view.getInt32(p)
            p += 4
          }
          let firstFlags: number | null = null
          if (flags & 0x4) {
            firstFlags = view.getUint32(p)
            p += 4
          }
          const chunk: number[] = []
          for (let i = 0; i < count; i += 1) {
            const duration = flags & 0x100 ? view.getUint32((p += 4) - 4) : defaults.duration
            const size = flags & 0x200 ? view.getUint32((p += 4) - 4) : defaults.size
            const sampleFlags = flags & 0x400 ? view.getUint32((p += 4) - 4) : i === 0 && firstFlags !== null ? firstFlags : defaults.flags
            const cto = flags & 0x800 ? (version === 1 ? view.getInt32((p += 4) - 4) : view.getUint32((p += 4) - 4)) : 0
            if (offset + size > source.length) return null
            chunk.push(track.samples.length)
            track.samples.push({ offset, size, duration, sync: ((sampleFlags >>> 16) & 1) === 0, cto })
            offset += size
          }
          if (chunk.length) {
            track.chunks.push(chunk)
            order.push({ track, chunk: track.chunks.length - 1 })
          }
        }
      }
    }
    if (![...tracks.values()].some((t) => t.samples.length)) return null

    // New mdat: chunks copied in file order; offsets are filled in once the moov size is known.
    const relative = new Map<Track, number[]>()
    let mdatLength = 0
    for (const { track, chunk } of order) {
      const list = relative.get(track) ?? []
      list[chunk] = mdatLength
      relative.set(track, list)
      for (const index of track.chunks[chunk]) mdatLength += track.samples[index].size
    }

    const buildMoov = (dataStart: number) => {
      const trakBoxes: Uint8Array[] = []
      let movieDuration = 0
      for (const track of tracks.values()) {
        if (!track.samples.length) continue
        const mediaDuration = track.samples.reduce((sum, s) => sum + s.duration, 0)
        const trackDuration = (mediaDuration * movieTimescale) / track.timescale
        movieDuration = Math.max(movieDuration, trackDuration)
        const durations = runs(track.samples.map((s) => s.duration))
        const ctos = track.samples.map((s) => s.cto)
        const stbl: Uint8Array[] = []
        const minf = child(view, child(view, track.trak, "mdia")!, "minf")!
        const oldStbl = child(view, minf, "stbl")!
        const stsd = child(view, oldStbl, "stsd")!
        stbl.push(source.slice(stsd.start, stsd.start + stsd.size))
        stbl.push(fullBox("stts", 0, (w) => {
          w.u32(durations.length)
          for (const [count, value] of durations) w.u32(count, value)
        }))
        if (ctos.some((v) => v !== 0)) {
          const negative = ctos.some((v) => v < 0)
          stbl.push(fullBox("ctts", negative ? 1 : 0, (w) => {
            const list = runs(ctos)
            w.u32(list.length)
            for (const [count, value] of list) {
              w.u32(count)
              w.i32(value)
            }
          }))
        }
        if (track.isVideo && track.samples.some((s) => !s.sync)) {
          const sync = track.samples.flatMap((s, i) => (s.sync ? [i + 1] : []))
          stbl.push(fullBox("stss", 0, (w) => w.u32(sync.length, ...sync)))
        }
        const perChunk = runs(track.chunks.map((c) => c.length))
        stbl.push(fullBox("stsc", 0, (w) => {
          w.u32(perChunk.length)
          let first = 1
          for (const [count, samples] of perChunk) {
            w.u32(first, samples, 1)
            first += count
          }
        }))
        stbl.push(fullBox("stsz", 0, (w) => w.u32(0, track.samples.length, ...track.samples.map((s) => s.size))))
        const offsets = (relative.get(track) ?? []).map((rel) => dataStart + rel)
        stbl.push(fullBox("stco", 0, (w) => w.u32(offsets.length, ...offsets)))
        const newMinf = box("minf", ...children(view, minf).map((b) => (b.type === "stbl" ? box("stbl", ...stbl) : source.slice(b.start, b.start + b.size))))
        const mdia = child(view, track.trak, "mdia")!
        const newMdia = box("mdia", ...children(view, mdia).map((b) =>
          b.type === "mdhd" ? withDuration(source, view, b, mediaDuration) : b.type === "minf" ? newMinf : source.slice(b.start, b.start + b.size)))
        trakBoxes.push(box("trak", ...children(view, track.trak).map((b) =>
          b.type === "tkhd" ? withDuration(source, view, b, trackDuration) : b.type === "mdia" ? newMdia : source.slice(b.start, b.start + b.size))))
      }
      const rest = children(view, moov).filter((b) => !["mvhd", "trak", "mvex"].includes(b.type)).map((b) => source.slice(b.start, b.start + b.size))
      return box("moov", withDuration(source, view, mvhd, movieDuration), ...trakBoxes, ...rest)
    }

    const ftyp = box("ftyp", new Uint8Array([0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31]))
    // The moov size does not depend on the offsets (stco is 32-bit): measure once, then build for real.
    const moovSize = buildMoov(0).length
    const dataStart = ftyp.length + moovSize + 8
    if (dataStart + mdatLength > 0xffffffff) return null
    const finalMoov = buildMoov(dataStart)
    const out = new Uint8Array(new ArrayBuffer(dataStart + mdatLength))
    out.set(ftyp, 0)
    out.set(finalMoov, ftyp.length)
    new DataView(out.buffer).setUint32(ftyp.length + moovSize, 8 + mdatLength)
    out.set([0x6d, 0x64, 0x61, 0x74], ftyp.length + moovSize + 4)
    let at = dataStart
    for (const { track, chunk } of order) {
      for (const index of track.chunks[chunk]) {
        const s = track.samples[index]
        out.set(source.subarray(s.offset, s.offset + s.size), at)
        at += s.size
      }
    }
    return out
  } catch {
    return null
  }
}

/** A recorded MP4 file made plain (see flattenMp4); any other file, or a failure, comes back unchanged. */
export async function plainMp4File(file: File): Promise<File> {
  if (!file.type.startsWith("video/mp4")) return file
  const flat = flattenMp4(await file.arrayBuffer())
  return flat ? new File([flat], file.name, { type: "video/mp4" }) : file
}
