export type IconName = "grid" | "text-size" | "close" | "chevron" | "card" | "user" | "home" | "plus" | "folder" | "picture" | "camera" | "zoom-in" | "zoom-out" | "play" | "pause" | "video" | "copy" | "arrow" | "menu" | "check" | "upload" | "download" | "share" | "window" | "sound" | "settings" | "mic" | "undo" | "keyboard"
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
    camera: "M3.5 9A2 2 0 0 1 5.5 7h2.2l1.4-2.2A1.5 1.5 0 0 1 10.4 4h3.2a1.5 1.5 0 0 1 1.3.8L16.3 7h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2ZM15.5 13a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0",
    chevron: "m9 5 7 7-7 7",
    grid: "M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM13 13h7v7h-7Z",
    "text-size": "M3 19 8 5l5 14M4.8 14h6.4M14 19l3.5-9 3.5 9M15.2 16h4.6",
    close: "M6 6l12 12M18 6 6 18",
    card: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM3 10h18M7 15h4",
    user: "M16 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0M4 20c.8-3.4 4-5 8-5s7.2 1.6 8 5",
    "zoom-in": "M21 21l-5-5M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0M7 10h6m-3-3v6",
    "zoom-out": "M21 21l-5-5M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0M7 10h6",
    play: "M8 5v14l11-7Z",
    pause: "M6 4h4v16H6ZM14 4h4v16h-4Z",
    video: "M3 6h12v12H3Zm12 4 6-3v10l-6-3",
    copy: "M7 3h14v14M3 7h14v14H3Z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    check: "m5 12 4 4L19 6",
    upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
    download: "M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5",
    share: "M7 11l10-6M7 13l10 6M8 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0M22 4a3 3 0 1 0-6 0 3 3 0 0 0 6 0M22 20a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
    window:
      "M3 4h18v16H3ZM3 9h18M7 6.5h.01M10 6.5h.01M7 13h4v4H7Zm7 0h3m-3 4h3",
    sound: "M3 9h4l5-5v16l-5-5H3Zm13-2c3 3 3 7 0 10m3-13c5 4 5 12 0 16",
    settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6",
    mic: "M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0ZM5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7",
    undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
    keyboard: "M2 6h20v12H2ZM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10",
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "play" || name === "pause" ? "currentColor" : "none"}
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
