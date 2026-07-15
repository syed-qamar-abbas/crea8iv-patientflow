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
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
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

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      if (sessionStorage.getItem('patientflow_sw_reloaded') === '1') return;
      sessionStorage.setItem('patientflow_sw_reloaded', '1');
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type !== 'PATIENTFLOW_UPDATED') return;
      if (sessionStorage.getItem('patientflow_sw_reloaded') === '1') return;
      sessionStorage.setItem('patientflow_sw_reloaded', '1');
      window.location.reload();
    });
  });
}
