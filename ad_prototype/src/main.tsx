import React from "react"

import ReactDOM from "react-dom/client"

import App from "./App"

import FeedbackProvider from "./FeedbackProvider"

import "./index.css"
import "./feedback-layout.css"
import "./maintenance-refinements.css"
import "./mobile-reference.css"
import "./compact-reference.css"
import "./focus-review.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </React.StrictMode>,
)
