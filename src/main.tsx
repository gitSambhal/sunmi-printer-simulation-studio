import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerApiInterceptor } from './lib/apiInterceptor.ts';

// Register Client-side API Interceptor for 100% serverless / Netlify static API compatibility
registerApiInterceptor();

// Register Service Worker for PWA Offline Support & API Interception
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('Sunmi Studio ServiceWorker registered with scope:', registration.scope);
      },
      (err) => {
        console.log('Sunmi Studio ServiceWorker registration failed:', err);
      }
    );
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


