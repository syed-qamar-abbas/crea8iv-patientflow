import { useEffect, useState } from 'react';
import { Globe, Copy, Check, Loader2, RefreshCw, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { fetchApi } from '../../config/api';
import { useClinic } from '../../context/ClinicContext';
import Modal from '../ui/Modal';

const STATUS_META = {
  none:        { label: 'Not configured', cls: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400' },
  pending:     { label: 'Pending DNS',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  dns_verified:{ label: 'DNS Verified',    cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  awaiting_ssl:{ label: 'Awaiting SSL Activation', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  connected:   { label: 'Connected',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  failed:      { label: 'Failed',          cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
};

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 font-mono break-all">{value}</code>
        <button type="button" onClick={copy} className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-colors" title="Copy">
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function CustomDomain() {
  const { term } = useClinic();
  const patientLabel = term('patient', 'patient');
  const [data, setData] = useState(null);
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = () => fetchApi('/settings/domain').then((d) => { setData(d); setDomain(d.customDomain || ''); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy('save'); setError('');
    try { setData(await fetchApi('/settings/domain', { method: 'PUT', body: JSON.stringify({ customDomain: domain }) })); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const verify = async () => {
    setBusy('verify'); setError('');
    try { setData(await fetchApi('/settings/domain/verify', { method: 'POST' })); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy('remove'); setError('');
    try { await fetchApi('/settings/domain', { method: 'DELETE' }); setConfirmRemove(false); setDomain(''); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading domain settings…</div>
      </div>
    );
  }

  const status = data.domainStatus || 'none';
  const meta = STATUS_META[status] || STATUS_META.none;
  const hasDomain = !!data.customDomain;
  const ins = data.instructions;

  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)' }}>
            <Globe className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Custom Domain</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Run your {patientLabel} portal on your own branded web address.</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${meta.cls}`}>{meta.label}</span>
      </div>

      {/* Domain input */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Portal Domain</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="portal.yourclinic.com"
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
          <button onClick={save} disabled={busy === 'save' || !domain} className="inline-flex items-center justify-center gap-2 bg-[var(--primary)] hover:opacity-90 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {hasDomain ? 'Update' : 'Connect Domain'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Use a subdomain you control, e.g. <span className="font-mono">portal.yourclinic.com</span>. Don&apos;t use your main website root.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* Connected banner */}
      {status === 'connected' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm px-4 py-3">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          Your portal is live and secured at <span className="font-bold">https://{data.customDomain}</span>
        </div>
      )}

      {/* Awaiting SSL banner */}
      {status === 'awaiting_ssl' && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-sm px-4 py-3">
          ✅ DNS verified. We&apos;re activating the secure certificate for <span className="font-bold">{data.customDomain}</span> — your domain goes live within 24 hours. No further action needed.
        </div>
      )}

      {/* DNS instructions + verify (shown until connected) */}
      {hasDomain && status !== 'connected' && ins && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-4 bg-gray-50/50 dark:bg-white/[0.02]">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Step 1 — Add these records at your domain provider</p>
            <p className="text-xs text-gray-500 mt-0.5">Log in to where you bought your domain (GoDaddy, Namecheap, Cloudflare, etc.) and add:</p>
          </div>

          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-2">
              <CopyField label="Type" value={ins.cname.type} />
              <CopyField label="Host / Name" value={ins.cname.host} />
              <CopyField label="Value / Target" value={ins.cname.value} />
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-[var(--primary)]">Optional: add this TXT record to speed up verification</summary>
              <div className="grid sm:grid-cols-3 gap-2 mt-2">
                <CopyField label="Type" value={ins.txt.type} />
                <CopyField label="Host / Name" value={ins.txt.host} />
                <CopyField label="Value" value={ins.txt.value} />
              </div>
            </details>
          </div>

          <div className="pt-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Step 2 — Verify the connection</p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={verify} disabled={busy === 'verify'} className="inline-flex items-center gap-2 bg-[var(--primary)] hover:opacity-90 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
                {busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Verify Domain
              </button>
              <span className="text-xs text-gray-400">DNS changes can take a few minutes to 24 hours to take effect.</span>
            </div>
            {status === 'failed' && data.domainLastError && (
              <p className="text-xs text-rose-600 mt-2">{data.domainLastError}</p>
            )}
          </div>
        </div>
      )}

      {hasDomain && (
        <button onClick={() => setConfirmRemove(true)} disabled={busy === 'remove'} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-rose-600">
          <Trash2 className="w-3.5 h-3.5" /> Remove custom domain
        </button>
      )}
      <Modal isOpen={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove Custom Domain" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Remove this custom domain? Your portal will only be reachable on the default address.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmRemove(false)} disabled={busy === 'remove'} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">
              Keep Domain
            </button>
            <button type="button" onClick={remove} disabled={busy === 'remove'} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">
              {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Remove Domain
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
