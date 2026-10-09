export type ServiceArtName = "service-hero" | "service-poster" | "service-video" | "service-copy" | "workflow-photo" | "workflow-details" | "workflow-results" | "workflow-channel" | "records-empty" | "guide-save" | "guide-copy" | "result-complete"

export default function ServiceArt({
  name,
  className = "",
  alt = "",
  priority = false,
}: {
  name: ServiceArtName
  className?: string
  alt?: string
  priority?: boolean
}) {
  const landscape = [
    "service-hero",
    "workflow-channel",
    "records-empty",
  ].includes(name)
  const base = `/assets/illustrations/phase4b/${name}`
  return (
    <img
      className={"service-art " + className}
      src={`${base}.webp`}
      srcSet={
        name === "service-hero"
          ? `${base}-640.webp 640w, ${base}.webp 960w`
          : undefined
      }
      sizes={
        name === "service-hero" ? "(max-width: 767px) 100vw, 58vw" : undefined
      }
      width={landscape ? 960 : 480}
      height={landscape ? 640 : 480}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  )
}
