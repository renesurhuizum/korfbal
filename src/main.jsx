import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App, { ErrorBoundary } from './App'
import { LandingPage } from './components/marketing/LandingPage'
import './index.css'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Als er geen Clerk key is (lokale preview), toon alleen de landingspagina
if (!clerkPublishableKey) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <LandingPage />
    </React.StrictMode>
  );
} else {
  const { convex } = await import('./convexClient');

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <App />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
