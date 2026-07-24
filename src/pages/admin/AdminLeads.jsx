import { useEffect, useState } from 'react';
import { Loader2, Plus, ArrowRightCircle, X } from 'lucide-react';
import { fetchApi } from '../../config/api';
import Modal from '../../components/ui/Modal';

const STATUSES = ['new', 'contacted', 'demo_given', 'payment_pending', 'payment_review', 'converted', 'rejected'];

const STATUS_STYLES = {
  new: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  contacted: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  demo_given: 'bg-orange-100 text-orange-600 dark:bg-orange-800/40 dark:text-orange-300',
  payment_pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  payment_review: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  converted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40';

const EMPTY_FORM = { clinicName: '', contactName: '', email: '', phone: '', whatsapp: '', city: '', clinicType: 'dental', branches: 1 };

function LeadConvertModal({ lead, busy, onClose, onConfirm }) {
  return (
    <Modal isOpen={!!lead} onClose={onClose} title="Convert Lead" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <p className="text-sm font-bold">{lead?.clinicName}</p>
          <p className="mt-1 text-xs leading-5">This creates a clinic account and generates a temporary owner password for admin handover.</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-xs dark:bg-white/5">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Contact</span>
            <span className="font-bold text-gray-900 dark:text-white">{lead?.contactName}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-gray-500">Email</span>
            <span className="break-all font-bold text-gray-900 dark:text-white">{lead?.email}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-white/10">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Convert
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LeadCredentialModal({ result, onClose }) {
  const [copied, setCopied] = useState('');
  if (!result) return null;
  const rows = [
    ['username', 'Username', result.ownerUsername],
    ['password', 'Password', result.ownerPassword],
    ['email', 'Contact email', result.ownerEmail],
  ];
  const credentialText = [
    result.message || 'Clinic created.',
    '',
    'Owner login',
    `Username: ${result.ownerUsername || ''}`,
    `Password: ${result.ownerPassword || ''}`,
    `Contact email: ${result.ownerEmail || ''}`,
  ].join('\n');

  const copy = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch (_) {
      setCopied('');
    }
  };

  return (
    <Modal isOpen={!!result} onClose={onClose} title="Lead Converted" size="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <p className="text-sm font-bold">{result.message || 'Clinic created successfully.'}</p>
          <p className="mt-1 text-xs leading-5">Copy these owner credentials for the clinic handover.</p>
        </div>
        <div className="grid gap-2">
          {rows.map(([key, label, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                <p className="break-all font-mono text-sm font-bold text-gray-900 dark:text-white">{value || '—'}</p>
              </div>
              {value && (
                <button type="button" onClick={() => copy(key, value)} className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300">
                  {copied === key ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => copy('all', credentialText)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:text-gray-300">{copied === 'all' ? 'Copied All' : 'Copy All'}</button>
          <button type="button" onClick={onClose} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700">Done</button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminLeads() {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [convertLead, setConvertLead] = useState(null);
  const [convertedResult, setConvertedResult] = useState(null);

  const load = () => fetchApi('/admin/leads').then(setLeads).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const setStatus = async (lead, status) => {
    setBusy(lead.id);
    try {
      await fetchApi(`/admin/leads/${lead.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const convert = async () => {
    if (!convertLead) return;
    setBusy(convertLead.id);
    setError('');
    try {
      const res = await fetchApi(`/admin/leads/${convertLead.id}/convert`, { method: 'POST' });
      setConvertLead(null);
      setConvertedResult(res);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const addLead = async (e) => {
    e.preventDefault();
    setBusy('add');
    setError('');
    try {
      await fetchApi('/admin/leads', { method: 'POST', body: JSON.stringify(form) });
      setForm(EMPTY_FORM);
      setShowAdd(false);
      await load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy('');
    }
  };

  if (!leads) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading leads...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Registration Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your sales pipeline — from website signup to live clinic.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-600/20 transition-colors"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Add Lead'}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {showAdd && (
        <form onSubmit={addLead} className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input required placeholder="Clinic name *" value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} className={inputCls} />
          <input required placeholder="Contact name *" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={inputCls} />
          <input required type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          <input required placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
          <input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} />
          <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
          <select value={form.clinicType} onChange={(e) => setForm({ ...form, clinicType: e.target.value })} className={inputCls}>
            <option value="dental">Dental</option>
            <option value="aesthetic">Aesthetic</option>
            <option value="medical">Medical</option>
            <option value="multi">Multi-specialty</option>
          </select>
          <button disabled={busy === 'add'} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2 transition-colors">
            {busy === 'add' ? 'Saving...' : 'Save Lead'}
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-white/5">
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">City / Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {leads.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No leads yet — they appear here when clinics register on your website.</td></tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-gray-900 dark:text-white">{lead.clinicName}</p>
                  <p className="text-xs text-gray-400">{String(lead.createdAt).slice(0, 10)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-700 dark:text-gray-300">{lead.contactName}</p>
                  <p className="text-xs text-gray-400">{lead.email} · {lead.phone}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {lead.city || '—'} <span className="text-xs text-gray-400">/ {lead.clinicType}</span>
                </td>
                <td className="px-4 py-3">
                  {lead.status === 'converted' ? (
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES.converted}`}>converted</span>
                  ) : (
                    <select
                      value={lead.status}
                      disabled={busy === lead.id}
                      onChange={(e) => setStatus(lead, e.target.value)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border-0 cursor-pointer ${STATUS_STYLES[lead.status] || ''}`}
                    >
                      {STATUSES.filter((s) => s !== 'converted').map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {lead.status !== 'converted' && lead.status !== 'rejected' && (
                    <button
                      onClick={() => setConvertLead(lead)}
                      disabled={busy === lead.id}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    >
                      {busy === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightCircle className="w-3.5 h-3.5" />}
                      Convert to clinic
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LeadConvertModal
        lead={convertLead}
        busy={busy === convertLead?.id}
        onClose={() => setConvertLead(null)}
        onConfirm={convert}
      />
      <LeadCredentialModal
        result={convertedResult}
        onClose={() => setConvertedResult(null)}
      />
    </div>
  );
}
