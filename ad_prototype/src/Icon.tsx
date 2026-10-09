export type IconName = "home" | "plus" | "folder" | "picture" | "video" | "copy" | "arrow" | "menu" | "check" | "upload" | "download" | "window" | "sound" | "settings"
export default function Icon({
  name,
  size = 24,
}: {
  name: IconName
  size?: number
}) {
  const paths: Record<IconName, string> = {
    home: "M3 10 12 3l9 7v10H3Zm5 10v-7h8v7",
    plus: "M12 5v14M5 12h14",
    folder: "M3 7V5h6l3 3h9v12H3Z",
    picture: "M3 4h18v16H3ZM3 16l5-5 5 5 4-4 4 4M16 8h.01",
    video: "M3 6h12v12H3Zm12 4 6-3v10l-6-3",
    copy: "M7 3h14v14M3 7h14v14H3Z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    check: "m5 12 4 4L19 6",
    upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
    download: "M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5",
    window:
      "M3 4h18v16H3ZM3 9h18M7 6.5h.01M10 6.5h.01M7 13h4v4H7Zm7 0h3m-3 4h3",
    sound: "M3 9h4l5-5v16l-5-5H3Zm13-2c3 3 3 7 0 10m3-13c5 4 5 12 0 16",
    settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6",
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
