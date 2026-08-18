import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AppNew';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => caches?.keys?.())
    .then((keys = []) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => {});
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const entryScript = [...document.scripts]
      .map((script) => script.src)
      .find((src) => /\/assets\/index-[^/]+\.js(?:\?|$)/.test(src));
    const buildId = entryScript?.match(/index-([^/.]+)\.js/)?.[1] || 'latest';
    const workerUrl = `${import.meta.env.BASE_URL}sw.js?v=${encodeURIComponent(buildId)}`;

    navigator.serviceWorker.register(workerUrl, { updateViaCache: 'none' }).then((registration) => {
      registration.update().catch(() => {});

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});

    const reloadForWorker = (scriptUrl) => {
      const reloadKey = 'patientflow_sw_reloaded_for';
      const workerVersion = scriptUrl || workerUrl;
      if (sessionStorage.getItem(reloadKey) === workerVersion) return;
      sessionStorage.setItem(reloadKey, workerVersion);
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      reloadForWorker(navigator.serviceWorker.controller?.scriptURL);
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type !== 'PATIENTFLOW_UPDATED') return;
      reloadForWorker(event.source?.scriptURL);
    });
  });
}
