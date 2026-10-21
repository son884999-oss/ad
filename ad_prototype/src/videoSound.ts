// Sound for the recorded videos (plan C, 2026-10-19): a short classical bed chosen by the kind of product, and one
// soft transition effect on each scene change, mixed through a limiter so nothing clips. Replaces the synthetic
// noise "whoosh" and fast chimes the owner heard as breaking. Files: public/assets/audio/ (licences:
// docs/라이선스/음원.md — Musopen public-domain / CC0 recordings; the transition effect is our own synthesis).

const AUDIO = "/assets/audio/"
const TRACKS = {
  chopinWaltz: "chopin-waltz-op69-1.mp3",
  satie: "satie-gymnopedie-1.mp3",
  bachAria: "bach-goldberg-aria.mp3",
  schubertAndante: "schubert-d664-andante.mp3",
  schubertAndantino: "schubert-d959-andantino.mp3",
  vivaldiAllegro: "vivaldi-spring-allegro.mp3",
  vivaldiLargo: "vivaldi-spring-largo.mp3",
} as const
const TRANSITION = "transition-shimmer.mp3"

// The livelier track first: 트렌디 picks it, every other product picks by its name (the same product always
// gets the same music, different products vary).
const GROUPS: [RegExp, string[]][] = [
  [/꽃|플라워|부케|화분|\b(flower|flowers|bouquet)\b/i, [TRACKS.vivaldiAllegro, TRACKS.vivaldiLargo]],
  [/케이크|마카롱|쿠키|베이글|타르트|머핀|브라우니|아이스크림|디저트|빵|과자|떡|초콜릿|초코|식품|반찬|김치|도시락|\b(cake|macaron|cookie|bread|dessert|chocolate|food)\b/i, [TRACKS.schubertAndante, TRACKS.bachAria]],
  [/커피|라떼|라테|녹차|홍차|밀크티|에이드|주스|스무디|음료|차|\b(coffee|latte|tea|juice|drink)\b/i, [TRACKS.chopinWaltz, TRACKS.satie]],
  [/화장품|세럼|로션|크림|스킨케어|립스틱|향수|샴푸|비누|\b(cosmetic|serum|lotion|skincare|lipstick|perfume|shampoo|soap)\b/i, [TRACKS.satie, TRACKS.schubertAndantino]],
]
const OTHER = [TRACKS.chopinWaltz, TRACKS.bachAria]

/** The bed for this product: by kind (food before beauty: "생크림" is not a cosmetic), then by mood or name. */
export function musicFor(text: string, tones: readonly string[] = []) {
  const list = GROUPS.find(([pattern]) => pattern.test(text))?.[1] ?? OTHER
  if (tones.includes("trendy")) return AUDIO + list[0]
  let hash = 0
  for (const char of text.trim()) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return AUDIO + list[Math.abs(hash) % list.length]
}

async function loadBuffer(audio: AudioContext, url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error("audio-load")
  return audio.decodeAudioData(await response.arrayBuffer())
}

/**
 * Prepares the mix into `stream` (its audio track is added now). Call start() right when the recording starts:
 * the bed fades in over 0.3 s and out over the last second of `seconds`; the effect plays at each cue (seconds).
 * Returns null when the browser cannot make sound; the video is then recorded silent, as before.
 */
export async function prepareVideoSound(stream: MediaStream, { musicUrl, seconds, cues }: { musicUrl: string; seconds: number; cues: number[] }) {
  let audio: AudioContext | null = null
  try {
    audio = new AudioContext()
    const [music, effect] = await Promise.all([loadBuffer(audio, musicUrl), loadBuffer(audio, AUDIO + TRANSITION).catch(() => null)])
    const destination = audio.createMediaStreamDestination()
    // The owner heard the mix as sharp and piercing (2026-10-19). Measured: the transition chime put its energy in
    // 2–4 kHz (only 7 dB under its total, peaks at -15 dB in that band) and the Vivaldi violins are bright above
    // 4 kHz. So: everything passes a high shelf (-8 dB above 3 kHz) for a warmer sound, the effect is low-passed
    // and softened below, and the limiter is only a safety catch near full scale (the old -10 dB / 8:1 setting
    // pressed on every piano attack).
    const limiter = audio.createDynamicsCompressor()
    limiter.threshold.value = -3
    limiter.knee.value = 3
    limiter.ratio.value = 12
    limiter.attack.value = 0.005
    limiter.release.value = 0.3
    const warmth = audio.createBiquadFilter()
    warmth.type = "highshelf"
    warmth.frequency.value = 3000
    warmth.gain.value = -8
    warmth.connect(limiter)
    limiter.connect(destination)
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
    const context = audio
    const start = () => {
      void context.resume().catch(() => undefined)
      const at = context.currentTime + 0.03
      const bed = context.createBufferSource()
      bed.buffer = music
      const bedGain = context.createGain()
      bedGain.gain.setValueAtTime(0.0001, at)
      bedGain.gain.linearRampToValueAtTime(0.15, at + 0.3)
      bedGain.gain.setValueAtTime(0.15, at + Math.max(0.4, seconds - 1))
      bedGain.gain.linearRampToValueAtTime(0.0001, at + seconds)
      bedGain.connect(warmth)
      // The clips are about 7.6 s; a longer video (10 s since 2026-10-21) cross-fades a second copy in over 1.2 s.
      const join = 1.2
      const first = context.createGain()
      bed.connect(first).connect(bedGain)
      bed.start(at)
      bed.stop(at + seconds + 0.05)
      if (music.duration < seconds) {
        const from = at + music.duration - join
        first.gain.setValueAtTime(1, from)
        first.gain.linearRampToValueAtTime(0.0001, from + join)
        const again = context.createBufferSource()
        again.buffer = music
        const second = context.createGain()
        second.gain.setValueAtTime(0.0001, from)
        second.gain.linearRampToValueAtTime(1, from + join)
        again.connect(second).connect(bedGain)
        again.start(from)
        again.stop(at + seconds + 0.05)
      }
      if (!effect) return
      for (const cue of cues) {
        if (cue >= seconds) continue
        const shimmer = context.createBufferSource()
        shimmer.buffer = effect
        // Low-passed (the chime's 2–4 kHz edge goes), quieter, and a 40 ms fade-in instead of a sharp onset.
        const soften = context.createBiquadFilter()
        soften.type = "lowpass"
        soften.frequency.value = 1800
        soften.Q.value = 0.5
        const shimmerGain = context.createGain()
        shimmerGain.gain.setValueAtTime(0.0001, at + cue)
        shimmerGain.gain.linearRampToValueAtTime(0.05, at + cue + 0.04)
        shimmer.connect(soften).connect(shimmerGain).connect(warmth)
        shimmer.start(at + cue)
      }
    }
    return { audio, start }
  } catch {
    void audio?.close().catch(() => undefined)
    return null
  }
}
