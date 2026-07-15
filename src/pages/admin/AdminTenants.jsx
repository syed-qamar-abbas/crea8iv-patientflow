import { useEffect, useMemo, useState } from 'react';
import { Archive, Loader2, PlayCircle, PauseCircle, CalendarPlus, Globe, Plus, Pencil, LogIn, Search, Copy, Check, X, Users as UsersIcon, Building2, CreditCard, Clock, MessageCircle, Bot, KeyRound, Megaphone, Facebook, Database, Eye, EyeOff } from 'lucide-react';
import { fetchApi, fetchPublicApi } from '../../config/api';
import Modal from '../../components/ui/Modal';
import ColorPicker from '../../components/ui/ColorPicker';
import { enterImpersonation } from '../../config/impersonation';

// Days until a date (negative = already past). Null-safe.
function daysLeft(date) {
  if (!date) return null;
  const ms = new Date(String(date).replace(' ', 'T')).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

// Small coloured pill summarising how long is left on a subscription.
function ExpiryBadge({ date, status }) {
  if (!date) return <span className="text-gray-400">—</span>;
  const d = daysLeft(date);
  const ymd = String(date).slice(0, 10);
  let tone = 'text-gray-500';
  let note = '';
  if (d < 0) { tone = 'text-rose-600 font-bold'; note = `expired ${Math.abs(d)}d ago`; }
  else if (d <= 7) { tone = 'text-rose-600 font-bold'; note = `${d}d left`; }
  else if (d <= 30) { tone = 'text-amber-600 font-semibold'; note = `${d}d left`; }
  else { note = `${d}d left`; }
  return (
    <span className="whitespace-nowrap">
      <span className="text-gray-600 dark:text-gray-300">{ymd}</span>
      <span className={`block text-[11px] ${tone}`}>{note}</span>
    </span>
  );
}

const DOMAIN_STATUS = {
  pending: 'text-amber-600',
  dns_verified: 'text-sky-600',
  awaiting_ssl: 'text-orange-600',
  connected: 'text-emerald-600',
  failed: 'text-rose-600',
};

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  trial: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  grace: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  archived: 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300',
  pending: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
};

const CLINIC_TYPES = ['dental', 'aesthetic', 'general', 'clinic', 'spa', 'salon'];

const field = 'w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-orange-300 text-gray-900 dark:text-gray-100';
const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'grace', label: 'Grace' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'pending', label: 'Pending' },
  { key: 'archived', label: 'Archived' },
  { key: 'expiring', label: 'Expiring ≤30d' },
];

const GROWTH_MODULES = [
  { key: 'marketingEnabled', label: 'Marketing', icon: Megaphone },
  { key: 'whatsappEnabled', label: 'WhatsApp', icon: MessageCircle },
  { key: 'aiEnabled', label: 'AI', icon: Bot },
  { key: 'metaLeadsEnabled', label: 'Meta', icon: Facebook },
  { key: 'importsEnabled', label: 'Imports', icon: Database },
];

const money = (value) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;

const prettyTemplate = (key = 'healthcare') => String(key || 'healthcare')
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

function suggestUsername(value) {
  return String(value || '')
    .toLowerCase()
    .split('@')[0]
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[._-]{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24);
}

function useUsernameAvailability(username, excludeUserId = '') {
  const [state, setState] = useState({ status: 'idle', message: '' });
  useEffect(() => {
    const value = String(username || '').trim().toLowerCase();
    if (!value) {
      setState({ status: 'idle', message: '' });
      return undefined;
    }
    if (value.length < 3) {
      setState({ status: 'invalid', message: 'Use at least 3 characters.' });
      return undefined;
    }
    setState({ status: 'checking', message: 'Checking availability...' });
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ username: value });
        if (excludeUserId) qs.set('excludeUserId', excludeUserId);
        const res = await fetchPublicApi(`/auth/username-availability?${qs.toString()}`);
        if (!res.valid) setState({ status: 'invalid', message: res.message || 'Invalid username.' });
        else if (res.available) setState({ status: 'available', message: 'Username is available.' });
        else setState({ status: 'taken', message: 'Username is already taken.' });
      } catch (e) {
        setState({ status: 'invalid', message: e.message || 'Could not check username.' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username, excludeUserId]);
  return state;
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [deleteTenant, setDeleteTenant] = useState(null);
  const [drawerId, setDrawerId] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [copiedId, setCopiedId] = useState('');

  const load = () => fetchApi('/admin/tenants').then(setTenants).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: tenants?.length || 0, expiring: 0 };
    (tenants || []).forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
      const d = daysLeft(t.subscriptionExpiresAt);
      if (d !== null && d >= 0 && d <= 30) c.expiring += 1;
    });
    return c;
  }, [tenants]);

  const filtered = useMemo(() => {
    let list = tenants || [];
    if (filter === 'expiring') {
      list = list.filter((t) => { const d = daysLeft(t.subscriptionExpiresAt); return d !== null && d >= 0 && d <= 30; });
    } else if (filter !== 'all') {
      list = list.filter((t) => t.status === filter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        [t.name, t.slug, t.customDomain, t.clinicType].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return list;
  }, [tenants, filter, query]);

  const manage = (t) => {
    if (!window.confirm(`Open ${t.name}'s portal as superadmin?\n\nYou'll be signed in as its owner to manage staff, services, branding and settings. A banner lets you exit back to admin anytime.`)) return;
    run(t.id, async () => {
      const res = await fetchApi(`/admin/tenants/${t.id}/impersonate`, { method: 'POST' });
      enterImpersonation({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user, clinicName: res.clinic?.name || t.name });
      window.location.assign(import.meta.env.BASE_URL + 'dashboard');
    });
  };

  const copyLoginLink = async (t) => {
    const base = t.customDomain ? `https://${t.customDomain}` : (window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''));
    const url = `${base}/login`;
    try { await navigator.clipboard.writeText(url); setCopiedId(t.id); setTimeout(() => setCopiedId(''), 1500); }
    catch (_) { window.prompt('Copy this login link:', url); }
  };

  const run = async (id, fn) => {
    setBusy(id);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const activate = (t) => {
    const cycle = window.prompt('Billing cycle: type "monthly" (default PKR 20,000) or "annual" (Starter yearly offer PKR 120,000 upfront)', 'monthly');
    if (!cycle || !['monthly', 'annual'].includes(cycle)) return;
    run(t.id, () => fetchApi(`/admin/tenants/${t.id}/activate`, { method: 'POST', body: JSON.stringify({ billingCycle: cycle }) }));
  };

  const suspend = (t) => {
    const reason = window.prompt(`Deactivate "${t.name}"? Enter a reason:`, 'Subscription unpaid');
    if (reason === null) return;
    run(t.id, () => fetchApi(`/admin/tenants/${t.id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }));
  };

  const extend = (t) => {
    const months = parseInt(window.prompt('Extend by how many months?', '1'), 10);
    if (!months || months < 1) return;
    run(t.id, () => fetchApi(`/admin/tenants/${t.id}/extend`, { method: 'POST', body: JSON.stringify({ months }) }));
  };

  const toggleGrowthFeature = (t, key) => {
    const next = !Number(t[key] || 0);
    run(t.id, async () => {
      const current = await fetchApi(`/admin/tenants/${t.id}/automation`);
      await fetchApi(`/admin/tenants/${t.id}/automation`, {
        method: 'PUT',
        body: JSON.stringify({
          features: {
            ...(current.features || {}),
            [key]: next,
          },
        }),
      });
    });
  };

  if (!tenants) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading clinics...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Clinics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create, edit, activate, deactivate, or archive tenants without deleting clinic data.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New Clinic
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {/* Search + status filter tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            data-global-search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clinics by name, domain, type…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f.key ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
            >
              {f.label}{counts[f.key] ? <span className="ml-1 opacity-70">{counts[f.key]}</span> : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-white/5">
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Subscription ends</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Patients</th>
              <th className="px-4 py-3">Growth</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{tenants.length === 0 ? 'No clinics yet. Click “New Clinic” to add one.' : 'No clinics match this filter.'}</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/70 dark:hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <button onClick={() => setDrawerId(t.id)} className="text-left group">
                    <p className="font-bold text-gray-900 dark:text-white group-hover:text-orange-600 group-hover:underline">{t.name}</p>
                  </button>
                  <p className="text-xs text-gray-400">{t.slug ? `${t.slug} · ` : ''}{t.clinicType}</p>
                  <p className="mt-1 inline-flex rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/10 dark:text-gray-300">{prettyTemplate(t.industryTemplate)}</p>
                  {t.customDomain && (
                    <p className="text-[11px] font-semibold mt-0.5 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-500">{t.customDomain}</span>
                      {t.domainStatus && t.domainStatus !== 'none' && (
                        <span className={DOMAIN_STATUS[t.domainStatus] || 'text-gray-400'}>· {t.domainStatus.replace('_', ' ')}</span>
                      )}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[t.status] || ''}`}>
                    {t.status}
                  </span>
                  {t.status === 'suspended' && t.suspensionReason && (
                    <p className="text-[10px] text-gray-400 mt-1 max-w-[180px] truncate">{t.suspensionReason}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ExpiryBadge date={t.subscriptionExpiresAt} status={t.status} />
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.userCount}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.patientCount}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setDrawerId(t.id)}
                    title={GROWTH_MODULES.map((m) => `${m.label}: ${Number(t[m.key] || 0) ? 'on' : 'off'}`).join('\n')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-white/10 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:border-orange-300 hover:text-orange-600"
                  >
                    <span className="flex gap-0.5">
                      {GROWTH_MODULES.map((m) => (
                        <span key={m.key} className={`w-1.5 h-1.5 rounded-full ${Number(t[m.key] || 0) ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`} />
                      ))}
                    </span>
                    {GROWTH_MODULES.filter((m) => Number(t[m.key] || 0)).length}/{GROWTH_MODULES.length}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {busy === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <>
                        {t.status !== 'archived' && (
                          <button onClick={() => manage(t)} title="Sign in to this clinic's portal as superadmin" className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 px-2.5 py-1.5 text-xs font-bold text-white">
                            <LogIn className="w-3.5 h-3.5" /> Manage
                          </button>
                        )}
                        {(() => {
                          const iconBtn = "p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10";
                          return (
                            <div className="flex items-center">
                              <button onClick={() => copyLoginLink(t)} title="Copy login link" className={iconBtn}>
                                {copiedId === t.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 hover:text-orange-600" />}
                              </button>
                              {(t.status === 'pending' || t.status === 'suspended' || t.status === 'grace') && (
                                <button onClick={() => activate(t)} title="Activate (new subscription)" className={`${iconBtn} hover:text-emerald-600`}><PlayCircle className="w-4 h-4" /></button>
                              )}
                              {t.subscriptionExpiresAt && t.status !== 'pending' && (
                                <button onClick={() => extend(t)} title="Extend subscription" className={`${iconBtn} hover:text-orange-600`}><CalendarPlus className="w-4 h-4" /></button>
                              )}
                              {(t.status === 'active' || t.status === 'trial' || t.status === 'grace') && (
                                <button onClick={() => suspend(t)} title="Deactivate access" className={`${iconBtn} hover:text-rose-600`}><PauseCircle className="w-4 h-4" /></button>
                              )}
                              <button onClick={() => setEditTenant(t)} title="Edit clinic details" className={`${iconBtn} hover:text-orange-600`}><Pencil className="w-4 h-4" /></button>
                              {t.status !== 'archived' && (
                                <button onClick={() => setDeleteTenant(t)} title="Archive clinic access" className={`${iconBtn} hover:text-rose-600`}><Archive className="w-4 h-4" /></button>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateClinicModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
      {editTenant && (
        <EditClinicModal
          tenant={editTenant}
          onClose={() => setEditTenant(null)}
          onSaved={() => { setEditTenant(null); load(); }}
        />
      )}
      {deleteTenant && (
        <DeleteClinicModal
          tenant={deleteTenant}
          onClose={() => setDeleteTenant(null)}
          onDeleted={() => { setDeleteTenant(null); load(); }}
        />
      )}
      {drawerId && (
        <TenantDrawer
          id={drawerId}
          onClose={() => setDrawerId(null)}
          onManage={(t) => { setDrawerId(null); manage(t); }}
          onEdit={(t) => { setDrawerId(null); setEditTenant(t); }}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Slide-over detail panel: owner(s), domain/SSL, subscription, usage counts.
function SubscriptionControls({ tenantId, status, currentSubscription, currentExpiry, onChanged }) {
  const toDateInput = (v) => {
    if (!v) return '';
    const d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  };
  const [date, setDate] = useState(toDateInput(currentExpiry));
  const [cycle, setCycle] = useState(currentSubscription?.billingCycle || 'monthly');
  const [amount, setAmount] = useState(currentSubscription?.amountPKR ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setDate(toDateInput(currentExpiry));
    setCycle(currentSubscription?.billingCycle || 'monthly');
    setAmount(currentSubscription?.amountPKR ?? '');
  }, [currentExpiry, currentSubscription?.billingCycle, currentSubscription?.amountPKR]);

  const daysLeft = currentExpiry ? Math.ceil((new Date(String(currentExpiry).replace(' ', 'T')) - new Date()) / 86400000) : null;

  const save = async (overrideDate) => {
    const expiresAt = overrideDate || date;
    if (!expiresAt) { setErr('Pick an end date first.'); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { expiresAt };
      if (cycle) body.billingCycle = cycle;
      if (amount !== '') body.amountPKR = Number(amount);
      const res = await fetchApi(`/admin/tenants/${tenantId}/subscription`, { method: 'POST', body: JSON.stringify(body) });
      setMsg(`Saved — ends ${String(res.expiresAt).slice(0, 10)} · ${res.status}`);
      onChanged?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const quick = (months) => {
    const base = currentExpiry && new Date(String(currentExpiry).replace(' ', 'T')) > new Date()
      ? new Date(String(currentExpiry).replace(' ', 'T')) : new Date();
    base.setMonth(base.getMonth() + months);
    const d = base.toISOString().slice(0, 10);
    setDate(d);
    save(d);
  };

  return (
    <section className="rounded-xl border border-gray-200/70 dark:border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Subscription</h3>
        {currentExpiry
          ? <span className={`text-[11px] font-bold ${daysLeft < 0 ? 'text-rose-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>{daysLeft < 0 ? `expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}</span>
          : <span className="text-[11px] text-gray-400">no active subscription</span>}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Subscription end date</label>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => save()} disabled={busy} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Sets the exact end date. Future date keeps the clinic active; a past date marks it expired.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 dark:bg-white/5">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Billing cycle</label>
          <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-xs">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Clinic deal price</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount PKR" className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white rounded-lg px-2 py-1.5 text-xs" />
        </div>
        <p className="col-span-2 text-[10px] text-gray-400">This is the custom amount shown in the clinic portal and used for MRR. Example: set monthly to 15000 if you pitched a discount.</p>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-gray-500 mb-1">Quick extend from current end</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 3, 6, 12].map((m) => (
            <button key={m} onClick={() => quick(m)} disabled={busy} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-gray-300 hover:border-orange-300 hover:text-orange-600 disabled:opacity-60">+{m} mo</button>
          ))}
        </div>
      </div>

      {msg && <p className="text-[11px] text-emerald-600 font-semibold">{msg}</p>}
      {err && <p className="text-[11px] text-rose-600 font-semibold">{err}</p>}
    </section>
  );
}

function TenantDrawer({ id, onClose, onManage, onEdit, onChanged }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const loadDrawer = () => fetchApi(`/admin/tenants/${id}`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => {
    setData(null); setErr('');
    loadDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const owner = data?.users?.find((u) => u.role === 'owner') || data?.users?.[0];
  const activeSubscription = data?.subscriptions?.find((s) => s.status === 'active');
  const expiry = activeSubscription?.expiresAt;

  const Row = ({ label, children }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-100 text-right break-words">{children}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
          <h2 className="text-lg font-black text-gray-900 dark:text-white truncate">{data?.name || 'Clinic'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        {err && <div className="m-5 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{err}</div>}
        {!data && !err && <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

        {data && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: UsersIcon, label: 'Patients', value: data.patientCount ?? (data.clients ?? '—') },
                { icon: Building2, label: 'Users', value: data.users?.length ?? '—' },
                { icon: CreditCard, label: 'Status', value: data.status },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-200/70 dark:border-white/10 p-3 text-center">
                  <s.icon className="w-4 h-4 mx-auto text-orange-500" />
                  <p className="text-sm font-black text-gray-900 dark:text-white mt-1 capitalize">{s.value}</p>
                  <p className="text-[11px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            <section className="rounded-xl border border-gray-200/70 dark:border-white/10 px-4 py-2">
              <Row label="Type">{data.clinicType || '—'}</Row>
              <Row label="Email">{data.email || '—'}</Row>
              <Row label="Phone">{data.phone || '—'}</Row>
              <Row label="Owner">{owner ? <>{owner.name}<span className="block text-xs text-gray-400">@{owner.username || 'not-set'} · {owner.email}</span></> : 'No owner'}</Row>
              <Row label="Portal link">{data.slug ? <a href={`https://crea8ivmedia.com/clinic/${data.slug}`} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline break-all">crea8ivmedia.com/clinic/{data.slug}</a> : '—'}</Row>
              <Row label="Custom domain">{data.customDomain ? <>{data.customDomain}<span className="block text-xs text-gray-400">{data.domainStatus} · SSL {data.sslStatus || 'n/a'}</span></> : 'None (uses portal link)'}</Row>
              <Row label="Subscription">{expiry ? <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" /><ExpiryBadge date={expiry} status={data.status} /></span> : '—'}</Row>
              <Row label="Billing">{activeSubscription ? <>{money(activeSubscription.amountPKR)}<span className="block text-xs capitalize text-gray-400">{activeSubscription.billingCycle}</span></> : '—'}</Row>
              <Row label="Created">{data.createdAt ? String(data.createdAt).slice(0, 10) : '—'}</Row>
            </section>

            <SubscriptionControls
              tenantId={data.id}
              status={data.status}
              currentSubscription={activeSubscription}
              currentExpiry={expiry}
              onChanged={() => { loadDrawer(); onChanged?.(); }}
            />

            <TenantAutomationControls tenantId={data.id} />

            {data.users?.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Team ({data.users.length})</h3>
                <div className="space-y-1">
                  {data.users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5">
                      <span className="text-gray-800 dark:text-gray-100">{u.name} <span className="text-xs text-gray-400">· @{u.username || 'not-set'} · {u.role}</span></span>
                      <span className="text-[11px] text-gray-400">{u.lastLogin ? `seen ${String(u.lastLogin).slice(0, 10)}` : 'never'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => onManage({ id: data.id, name: data.name })} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold">
                <LogIn className="w-4 h-4" /> Manage clinic
              </button>
              <button onClick={() => onEdit(data)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TenantAutomationControls({ tenantId }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setData(null); setDraft(null); setErr(''); setNotice('');
    fetchApi(`/admin/tenants/${tenantId}/automation`).then((res) => {
      setData(res);
      setDraft({
        features: {
          industryTemplate: res.features?.industryTemplate || 'healthcare',
          marketingEnabled: !!Number(res.features?.marketingEnabled),
          metaLeadsEnabled: !!Number(res.features?.metaLeadsEnabled),
          importsEnabled: !!Number(res.features?.importsEnabled),
          whatsappEnabled: !!Number(res.features?.whatsappEnabled),
          whatsappMarketingEnabled: !!Number(res.features?.whatsappMarketingEnabled),
          whatsappAutomationEnabled: !!Number(res.features?.whatsappAutomationEnabled),
          aiEnabled: !!Number(res.features?.aiEnabled),
          aiAutoReplyEnabled: !!Number(res.features?.aiAutoReplyEnabled),
          aiHumanApprovalRequired: Number(res.features?.aiHumanApprovalRequired ?? 1) ? true : false,
          monthlyAiTokenLimit: Number(res.features?.monthlyAiTokenLimit || 0),
          monthlyWhatsAppLimit: Number(res.features?.monthlyWhatsAppLimit || 0),
        },
        whatsapp: {
          phoneNumberId: res.whatsapp?.phoneNumberId || '',
          businessAccountId: res.whatsapp?.businessAccountId || '',
          accessToken: '',
          webhookVerifyToken: '',
          apiVersion: res.whatsapp?.apiVersion || 'v23.0',
          simulationMode: Number(res.whatsapp?.simulationMode ?? 1) ? true : false,
          quietHoursStart: res.whatsapp?.quietHoursStart || '21:00',
          quietHoursEnd: res.whatsapp?.quietHoursEnd || '09:00',
        },
        platformAiProviders: (res.platformAiProviders || []).map((p) => ({ ...p, apiKey: '' })),
        packagePricing: res.packagePricing || {},
      });
    }).catch((e) => setErr(e.message));
  }, [tenantId]);

  const setFeature = (key, value) => setDraft((d) => ({ ...d, features: { ...d.features, [key]: value } }));
  const setWhatsapp = (key, value) => setDraft((d) => ({ ...d, whatsapp: { ...d.whatsapp, [key]: value } }));
  const setProvider = (idx, key, value) => setDraft((d) => ({
    ...d,
    platformAiProviders: d.platformAiProviders.map((p, i) => i === idx ? { ...p, [key]: value } : p),
  }));
  const setPackagePrice = (packageKey, fieldKey, value) => setDraft((d) => ({
    ...d,
    packagePricing: {
      ...(d.packagePricing || {}),
      [packageKey]: {
        ...((d.packagePricing || {})[packageKey] || {}),
        [fieldKey]: value,
      },
    },
  }));

  const save = async () => {
    setSaving(true); setErr(''); setNotice('');
    try {
      const res = await fetchApi(`/admin/tenants/${tenantId}/automation`, { method: 'PUT', body: JSON.stringify(draft) });
      setData(res);
      setDraft((d) => ({
        ...d,
        whatsapp: { ...d.whatsapp, accessToken: '', webhookVerifyToken: '' },
        platformAiProviders: d.platformAiProviders.map((p) => ({ ...p, apiKey: '' })),
      }));
      setNotice('Automation controls saved.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changePackage = async (key) => {
    if (key === data.package) return;
    setSaving(true); setErr(''); setNotice('');
    try {
      await fetchApi(`/admin/tenants/${tenantId}/package`, { method: 'PUT', body: JSON.stringify({ package: key }) });
      const res = await fetchApi(`/admin/tenants/${tenantId}/automation`);
      setData(res);
      setDraft((d) => ({
        ...d,
        features: {
          ...d.features,
          industryTemplate: res.features?.industryTemplate || d.features.industryTemplate || 'healthcare',
          marketingEnabled: !!Number(res.features?.marketingEnabled),
          metaLeadsEnabled: !!Number(res.features?.metaLeadsEnabled),
          importsEnabled: !!Number(res.features?.importsEnabled),
          whatsappEnabled: !!Number(res.features?.whatsappEnabled),
          whatsappMarketingEnabled: !!Number(res.features?.whatsappMarketingEnabled),
          whatsappAutomationEnabled: !!Number(res.features?.whatsappAutomationEnabled),
          aiEnabled: !!Number(res.features?.aiEnabled),
          aiAutoReplyEnabled: !!Number(res.features?.aiAutoReplyEnabled),
        },
      }));
      const changedName = (res.packages || data.packages || []).find((p) => p.key === key)?.name
        || (key === 'ai' ? 'AppointmentFlow AI' : 'Starter');
      setNotice(`Package changed to ${changedName}.`);
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const resetOwnerPassword = async () => {
    if (!window.confirm('Generate a new owner password for this clinic? The existing owner password will stop working.')) return;
    setSaving(true); setErr(''); setNotice('');
    try {
      const res = await fetchApi(`/admin/tenants/${tenantId}/owner-password`, { method: 'POST' });
      setData((d) => ({ ...d, credentials: res.credentials }));
      setShowOwnerPassword(true);
      setNotice('Owner password generated and saved.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!data || !draft) {
    return <section className="rounded-xl border border-gray-200/70 p-4 text-sm text-gray-400 dark:border-white/10"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading automation controls…</section>;
  }
  const industryTemplates = data.industryTemplates?.length
    ? data.industryTemplates
    : [{ templateKey: 'healthcare', name: 'Healthcare' }];

  return (
    <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/10">
      <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/10 p-3">
        <p className="text-xs font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">Subscription package</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">One active package — controls which modules this clinic sees &amp; uses. Starter standard is PKR 20,000/mo or PKR 120,000/year.</p>
        <div className="flex flex-wrap gap-2">
          {(data.packages || []).map((p) => (
            <button
              key={p.key}
              onClick={() => changePackage(p.key)}
              disabled={saving}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors disabled:opacity-60 ${data.package === p.key ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-orange-300 hover:text-orange-600'}`}
            >
              {data.package === p.key ? '✓ ' : ''}{p.name} · {money(p.pricePKR)}/mo
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-300">Custom package pricing</p>
        <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">Use this when you pitch a clinic a custom rate. The active subscription amount still controls what the clinic portal shows after activation.</p>
        <div className="grid gap-3">
          {(data.packages || []).map((p) => {
            const override = draft.packagePricing?.[p.key] || {};
            return (
              <div key={p.key} className="grid gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 sm:grid-cols-[1fr_120px_120px]">
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{p.name}</p>
                  <p className="text-[11px] text-gray-400">{p.tagline}</p>
                </div>
                <label className="text-[11px] font-semibold text-gray-500">Monthly PKR
                  <input className={field} type="number" min="0" value={override.pricePKR ?? p.pricePKR ?? ''} onChange={(e) => setPackagePrice(p.key, 'pricePKR', e.target.value)} />
                </label>
                <label className="text-[11px] font-semibold text-gray-500">Annual PKR
                  <input className={field} type="number" min="0" value={override.annualPricePKR ?? p.annualPricePKR ?? ''} onChange={(e) => setPackagePrice(p.key, 'annualPricePKR', e.target.value)} />
                </label>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-300">Industry Template</p>
        <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">Changes labels, terminology and dashboard wording only. It does not change stored clinic data or workflows.</p>
        <select
          className={field}
          value={draft.features.industryTemplate || 'healthcare'}
          onChange={(e) => setFeature('industryTemplate', e.target.value)}
          disabled={saving}
        >
          {industryTemplates.map((tpl) => (
            <option key={tpl.templateKey} value={tpl.templateKey}>{tpl.name}</option>
          ))}
        </select>
      </div>
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-300">Owner login credentials</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Admin-visible owner username and password for handover and support.</p>
          </div>
          <button
            onClick={resetOwnerPassword}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300"
          >
            <KeyRound className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
        <div className="grid gap-2">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Owner username</p>
            <p className="break-all text-sm font-semibold text-gray-800 dark:text-gray-100">{data.credentials?.username ? `@${data.credentials.username}` : 'Not stored yet'}</p>
            {data.credentials?.email && <p className="mt-1 break-all text-[11px] text-gray-400">Contact email: {data.credentials.email}</p>}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Owner password</p>
                <p className="break-all font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {data.credentials?.password
                    ? (showOwnerPassword ? data.credentials.password : '************')
                    : 'No stored password yet. Reset to generate one.'}
                </p>
              </div>
              {data.credentials?.password && (
                <button
                  type="button"
                  title={showOwnerPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowOwnerPassword((v) => !v)}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-orange-600 dark:hover:bg-white/10"
                >
                  {showOwnerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
            {data.credentials?.updatedAt && (
              <p className="mt-1 text-[10px] text-gray-400">Last saved {String(data.credentials.updatedAt).slice(0, 16)}</p>
            )}
          </div>
          {data.clinic?.slug && (
            <p className="text-[11px] text-gray-400">Portal: crea8ivmedia.com/clinic/{data.clinic.slug}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-gray-900 dark:text-white">Automation & AI</h3>
          <p className="mt-1 text-xs text-gray-400">Fine-tune individual features (the package sets these automatically).</p>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
      {err && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
      {notice && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div>}

      <div className="mt-4 grid gap-3">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400"><Megaphone className="h-4 w-4" /> Growth modules</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {GROWTH_MODULES.map(({ key, label, icon: Icon }) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold dark:border-white/10 dark:bg-slate-900">
                <input type="checkbox" checked={!!draft.features[key]} onChange={(e) => setFeature(key, e.target.checked)} />
                <Icon className="h-4 w-4 text-gray-400" />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">Controls the five Growth menu items shown in the clinic portal sidebar.</p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400"><MessageCircle className="h-4 w-4" /> WhatsApp package</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['whatsappEnabled', 'Enable WhatsApp'],
              ['whatsappMarketingEnabled', 'Marketing broadcasts'],
              ['whatsappAutomationEnabled', 'Journeys / automations'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold dark:border-white/10 dark:bg-slate-900">
                <input type="checkbox" checked={!!draft.features[key]} onChange={(e) => setFeature(key, e.target.checked)} /> {label}
              </label>
            ))}
            <label className="text-xs font-semibold text-gray-500">Monthly message limit<input className={field} type="number" min="0" value={draft.features.monthlyWhatsAppLimit} onChange={(e) => setFeature('monthlyWhatsAppLimit', Number(e.target.value))} /></label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className={field} placeholder="Phone Number ID" value={draft.whatsapp.phoneNumberId} onChange={(e) => setWhatsapp('phoneNumberId', e.target.value)} />
            <input className={field} placeholder="WhatsApp Business Account ID" value={draft.whatsapp.businessAccountId} onChange={(e) => setWhatsapp('businessAccountId', e.target.value)} />
            <input className={field} placeholder={data.whatsapp?.hasAccessToken ? 'Access token saved - enter to replace' : 'Permanent access token'} type="password" value={draft.whatsapp.accessToken} onChange={(e) => setWhatsapp('accessToken', e.target.value)} />
            <input className={field} placeholder="Webhook verify token" value={draft.whatsapp.webhookVerifyToken} onChange={(e) => setWhatsapp('webhookVerifyToken', e.target.value)} />
            <input className={field} placeholder="Graph API version" value={draft.whatsapp.apiVersion} onChange={(e) => setWhatsapp('apiVersion', e.target.value)} />
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold dark:border-white/10 dark:bg-slate-900"><input type="checkbox" checked={draft.whatsapp.simulationMode} onChange={(e) => setWhatsapp('simulationMode', e.target.checked)} /> Simulation mode</label>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400"><Bot className="h-4 w-4" /> AI package</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['aiEnabled', 'Enable AI hub'],
              ['aiAutoReplyEnabled', 'AI receptionist auto-reply'],
              ['aiAutoBookEnabled', 'Auto-book appointments'],
              ['aiHumanApprovalRequired', 'Require human approval'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold dark:border-white/10 dark:bg-slate-900">
                <input type="checkbox" checked={!!draft.features[key]} onChange={(e) => setFeature(key, e.target.checked)} /> {label}
              </label>
            ))}
            <label className="text-xs font-semibold text-gray-500">Monthly token limit<input className={field} type="number" min="0" value={draft.features.monthlyAiTokenLimit} onChange={(e) => setFeature('monthlyAiTokenLimit', Number(e.target.value))} /></label>
          </div>
          <div className="mt-3 space-y-2">
            {draft.platformAiProviders.map((provider, idx) => (
              <div key={provider.provider} className="grid gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900 sm:grid-cols-[90px_1fr_1fr]">
                <label className="flex items-center gap-2 text-xs font-bold capitalize"><input type="checkbox" checked={!!provider.enabled} onChange={(e) => setProvider(idx, 'enabled', e.target.checked)} /> {provider.provider}</label>
                <input className={field} placeholder="Model" value={provider.model || ''} onChange={(e) => setProvider(idx, 'model', e.target.value)} />
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input className={`${field} pl-9`} type="password" placeholder={provider.hasApiKey ? 'API key saved - enter to replace' : 'API key'} value={provider.apiKey || ''} onChange={(e) => setProvider(idx, 'apiKey', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------
function CreateClinicModal({ onClose, onCreated }) {
  const [f, setF] = useState({
    name: '', email: '', phone: '', clinicType: 'dental', address: '',
    status: 'trial', trialDays: 14,
    primaryColor: '#0f766e', secondaryColor: '#14b8a6',
    ownerName: '', ownerUsername: '', ownerEmail: '', ownerPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const ownerUsername = useUsernameAvailability(f.ownerUsername);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      const body = {
        name: f.name, email: f.email, phone: f.phone, clinicType: f.clinicType, address: f.address,
        status: f.status, trialDays: Number(f.trialDays) || 14,
        primaryColor: f.primaryColor, secondaryColor: f.secondaryColor,
        owner: { name: f.ownerName, username: f.ownerUsername, email: f.ownerEmail || f.email, password: f.ownerPassword },
      };
      const res = await fetchApi('/admin/tenants', { method: 'POST', body: JSON.stringify(body) });
      if (res.ownerPassword) {
        window.alert(`${res.message || 'Clinic created.'}\n\nOwner login\nUsername: ${res.ownerUsername}\nPassword: ${res.ownerPassword}\nContact email: ${res.ownerEmail}`);
      } else {
        window.alert(res.message || 'Clinic created.');
      }
      onCreated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="New Clinic" size="lg">
      <div className="space-y-5">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{err}</div>}

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Clinic details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Clinic name *</label><input className={field} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value, ownerUsername: p.ownerUsername || suggestUsername(e.target.value) }))} placeholder="The Smile Experts" /></div>
            <div><label className={labelCls}>Clinic email</label><input className={field} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="hello@clinic.com" /></div>
            <div><label className={labelCls}>Phone</label><input className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+92 300 ..." /></div>
            <div><label className={labelCls}>Type</label>
              <select className={field} value={f.clinicType} onChange={(e) => set('clinicType', e.target.value)}>
                {CLINIC_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>Address</label><input className={field} value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Initial owner account</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Owner name</label><input className={field} value={f.ownerName} onChange={(e) => setF((p) => ({ ...p, ownerName: e.target.value, ownerUsername: p.ownerUsername || suggestUsername(e.target.value) }))} placeholder="Dr. Name" /></div>
            <div>
              <label className={labelCls}>Owner username *</label>
              <input className={field} value={f.ownerUsername} onChange={(e) => set('ownerUsername', e.target.value.toLowerCase())} placeholder="dr-smile" autoComplete="username" />
              {ownerUsername.message && (
                <p className={`mt-1 text-[11px] font-semibold ${ownerUsername.status === 'available' ? 'text-emerald-600' : ownerUsername.status === 'checking' ? 'text-gray-400' : 'text-rose-600'}`}>{ownerUsername.message}</p>
              )}
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>Owner contact email *</label><input className={field} type="email" value={f.ownerEmail} onChange={(e) => setF((p) => ({ ...p, ownerEmail: e.target.value, ownerUsername: p.ownerUsername || suggestUsername(e.target.value) }))} placeholder="owner@clinic.com" /></div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Initial password</label>
              <input className={field} type="text" value={f.ownerPassword} onChange={(e) => set('ownerPassword', e.target.value)} placeholder="Leave blank to auto-generate" />
              <p className="text-[11px] text-gray-400 mt-1">Set a password so the owner can log in immediately (min 10 chars), or leave blank to auto-generate an admin-visible temporary password.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Activation & branding</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Initial status</label>
              <select className={field} value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            {f.status === 'trial' && (
              <div><label className={labelCls}>Trial days</label><input className={field} type="number" min="1" value={f.trialDays} onChange={(e) => set('trialDays', e.target.value)} /></div>
            )}
          </div>
          <ColorPicker label="Primary color" value={f.primaryColor} onChange={(v) => set('primaryColor', v)} />
          <ColorPicker label="Accent color" value={f.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
        </section>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10">Cancel</button>
          <button onClick={submit} disabled={saving || !f.name || !(f.ownerEmail || f.email) || ownerUsername.status !== 'available'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-bold">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create clinic
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
function EditClinicModal({ tenant, onClose, onSaved }) {
  const [f, setF] = useState({
    name: tenant.name || '', email: tenant.email || '', phone: tenant.phone || '',
    clinicType: tenant.clinicType || 'dental', address: tenant.address || '',
    primaryColor: tenant.primaryColor || '#0f766e', secondaryColor: tenant.secondaryColor || '#14b8a6',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      await fetchApi(`/admin/tenants/${tenant.id}`, { method: 'PUT', body: JSON.stringify(f) });
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Edit — ${tenant.name}`} size="lg">
      <div className="space-y-5">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={labelCls}>Clinic name</label><input className={field} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><label className={labelCls}>Clinic email</label><input className={field} value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div><label className={labelCls}>Phone</label><input className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className={labelCls}>Type</label>
            <select className={field} value={f.clinicType} onChange={(e) => set('clinicType', e.target.value)}>
              {CLINIC_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className={labelCls}>Address</label><input className={field} value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
        </div>
        <ColorPicker label="Primary color" value={f.primaryColor} onChange={(v) => set('primaryColor', v)} />
        <ColorPicker label="Accent color" value={f.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-bold">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
function DeleteClinicModal({ tenant, onClose, onDeleted }) {
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      await fetchApi(`/admin/tenants/${tenant.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Archive clinic" size="md">
      <div className="space-y-4">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{err}</div>}
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-3 text-sm">
          This archives <b>{tenant.name}</b>, revokes active sessions, and deactivates clinic users. Patients, appointments, invoices, staff, and settings remain stored.
        </div>
        <div>
          <label className={labelCls}>Type the clinic name to confirm</label>
          <input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={tenant.name} />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10">Cancel</button>
          <button onClick={submit} disabled={saving || confirm !== tenant.name} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Archive clinic
          </button>
        </div>
      </div>
    </Modal>
  );
}
