import React from "react"

import ReactDOM from "react-dom/client"

import App from "./App"

import FeedbackProvider from "./FeedbackProvider"

import "./index.css"
import "./reference-ui.css"
import "./photo-step.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </React.StrictMode>,
)
