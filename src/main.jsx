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
    const reloadKey = 'patientflow_sw_retired_20260825';

    Promise.all([
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
      typeof caches !== 'undefined' && caches.keys
        ? caches.keys().then((keys = []) => Promise.all(
          keys
            .filter((key) => key.startsWith('patientflow-'))
            .map((key) => caches.delete(key)),
        ))
        : Promise.resolve(),
    ]).then(() => {
      if (!navigator.serviceWorker.controller || sessionStorage.getItem(reloadKey)) return;
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
    }).catch(() => {});
  });
}
