import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexProvider } from "convex/react"
import App, { ErrorBoundary } from './App'
import { convex } from './convexClient'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
