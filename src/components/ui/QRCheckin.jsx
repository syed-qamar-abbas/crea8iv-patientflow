import { CheckCircle, Loader2, Printer, QrCode, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchApi } from '../../config/api';
import { useClinic } from '../../context/ClinicContext';

function formatExpiry(value) {
  if (!value) return '—';
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function QRCheckin({ appointment, isOpen, onClose, onCheckin }) {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Client');
  const serviceLabel = term('service', 'Service');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');

  const issueToken = useCallback(async () => {
    if (!appointment?.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchApi(`/appointments/${appointment.id}/checkin-token`, { method: 'POST' });
      setToken(result);
    } catch (err) {
      setToken(null);
      setError(err.message || 'Secure QR could not be generated.');
    } finally {
      setLoading(false);
    }
  }, [appointment?.id]);

  useEffect(() => {
    if (!isOpen) {
      setToken(null);
      setError('');
      document.body.style.overflow = '';
      return undefined;
    }
    document.body.style.overflow = 'hidden';
    issueToken();
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, issueToken]);

  if (!isOpen || !appointment) return null;

  const clientName = appointment.clientName || appointment.client?.name || patientLabel;
  const serviceName = appointment.serviceName || appointment.service?.name || appointment.otherTreatment || serviceLabel;

  const manualCheckin = async () => {
    setCheckingIn(true);
    setError('');
    try {
      await onCheckin?.(appointment);
      onClose();
    } catch (err) {
      setError(err.message || 'Check-in failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="qr-checkin-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-600" />
            <h2 id="qr-checkin-title" className="text-base font-semibold text-gray-900 dark:text-white">Secure QR check-in</h2>
          </div>
          <button onClick={onClose} aria-label="Close QR check-in" className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-5 p-6">
          <div className="flex h-52 w-52 items-center justify-center rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm">
            {loading && <Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-label="Generating secure QR" />}
            {!loading && token?.qrImage && <img src={token.qrImage} alt="Secure appointment check-in QR code" className="h-full w-full" />}
            {!loading && !token?.qrImage && <QrCode className="h-14 w-14 text-gray-300" />}
          </div>

          <div className="w-full rounded-xl bg-indigo-50 px-4 py-3 text-center text-xs text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
            <p className="font-semibold">Contains a short-lived opaque token only</p>
            <p className="mt-1">Expires: {formatExpiry(token?.expiresAt)}</p>
          </div>

          {error && <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}

          <div className="w-full space-y-2.5 rounded-xl bg-gray-50 p-4 dark:bg-white/5">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-gray-500">{patientLabel}</span>
              <span className="text-right font-semibold text-gray-900 dark:text-white">{clientName}</span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-gray-500">{serviceLabel}</span>
              <span className="max-w-[55%] truncate text-right font-semibold text-gray-900 dark:text-white">{serviceName}</span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-gray-500">Time</span>
              <span className="font-semibold text-gray-900 dark:text-white">{appointment.startTime}</span>
            </div>
          </div>

          <button onClick={issueToken} disabled={loading} className="flex items-center gap-2 text-xs font-semibold text-indigo-700 disabled:opacity-50 dark:text-indigo-300">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate secure QR
          </button>

          <div className="flex w-full gap-3">
            <button onClick={() => window.print()} disabled={!token?.qrImage} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
              <Printer className="h-4 w-4" /> Print QR
            </button>
            <button onClick={manualCheckin} disabled={checkingIn} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
              {checkingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Manual check-in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
