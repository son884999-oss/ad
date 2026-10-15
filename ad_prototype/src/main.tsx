import React from "react"

import ReactDOM from "react-dom/client"

import App from "./App"

import FeedbackProvider from "./FeedbackProvider"

import { DevToolbar } from "./DesktopStage"

import "./index.css"
import "./reference-ui.css"
import "./pc-layout.css"
import "./photo-step.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
      <DevToolbar />
    </FeedbackProvider>
  </React.StrictMode>,
)
