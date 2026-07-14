import { useEffect, useMemo, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [forced, setForced] = useState(false);
  const ios = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    if (isStandalone()) return undefined;

    const dismissed = localStorage.getItem('patientflow_install_dismissed_v1') === 'true';
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      if (!dismissed) setVisible(true);
    };
    const onManualRequest = () => {
      setForced(true);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('patientflow:install-prompt', onManualRequest);
    if (ios && !dismissed) setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('patientflow:install-prompt', onManualRequest);
    };
  }, [ios]);

  if (!visible || isStandalone()) return null;

  const close = () => {
    if (!forced) localStorage.setItem('patientflow_install_dismissed_v1', 'true');
    setForced(false);
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    close();
  };

  return (
    <div className="fixed inset-x-3 bottom-[86px] z-[55] md:hidden">
      <div className="rounded-2xl border border-white/60 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            {ios ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-950 dark:text-white">Install PatientFlow on this phone</p>
            {installEvent ? (
              <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-300">Tap Install for a full-screen app shortcut with faster access.</p>
            ) : ios ? (
              <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-300">On iPhone: tap Share, then choose Add to Home Screen.</p>
            ) : (
              <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-300">Open your browser menu and choose Install app or Add to Home screen.</p>
            )}
          </div>
          <button type="button" onClick={close} className="h-8 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Close install prompt">
            <X className="h-4 w-4" />
          </button>
        </div>
        {installEvent && (
          <button
            type="button"
            onClick={install}
            className="mt-3 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-black text-white shadow-lg"
          >
            Install app
          </button>
        )}
      </div>
    </div>
  );
}
