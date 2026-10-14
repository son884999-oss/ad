import React from "react"

import ReactDOM from "react-dom/client"

import App from "./App"

import FeedbackProvider from "./FeedbackProvider"

import { DesktopAside, DevToolbar } from "./DesktopStage"

import "./index.css"
import "./reference-ui.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <DesktopAside />
      <App />
      <DevToolbar />
    </FeedbackProvider>
  </React.StrictMode>,
)
