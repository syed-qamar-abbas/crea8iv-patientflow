import { useEffect, useState } from 'react';
import { Loader2, Plus, X, CheckCircle2, XCircle } from 'lucide-react';
import { fetchApi } from '../../config/api';

const pkr = (n) => 'PKR ' + Number(n || 0).toLocaleString('en-PK');

const STATUS_STYLES = {
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40';

export default function AdminPayments() {
  const [payments, setPayments] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clinicId: '', amountPKR: 20000, method: 'bank_transfer', reference: '' });

  const load = (f = filter) =>
    fetchApi(`/admin/payments${f ? `?status=${f}` : ''}`).then(setPayments).catch((e) => setError(e.message));

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    fetchApi('/admin/tenants').then(setTenants).catch(() => {});
  }, []);

  const act = async (id, action) => {
    setBusy(id);
    setError('');
    try {
      await fetchApi(`/admin/payments/${id}/${action}`, { method: 'PUT' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const record = async (e) => {
    e.preventDefault();
    setBusy('add');
    setError('');
    try {
      await fetchApi('/admin/payments', { method: 'POST', body: JSON.stringify(form) });
      setShowAdd(false);
      setForm({ clinicId: '', amountPKR: 20000, method: 'bank_transfer', reference: '' });
      await load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy('');
    }
  };

  if (!payments) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading payments...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Payments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manual payment records — verify before activating or extending.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={inputCls + ' !w-auto'}>
            <option value="">All statuses</option>
            <option value="submitted">Awaiting review</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-600/20 transition-colors"
          >
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? 'Cancel' : 'Record Payment'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {showAdd && (
        <form onSubmit={record} className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select required value={form.clinicId} onChange={(e) => setForm({ ...form, clinicId: e.target.value })} className={inputCls}>
            <option value="">Select clinic *</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input required type="number" min="1" placeholder="Amount (PKR) *" value={form.amountPKR} onChange={(e) => setForm({ ...form, amountPKR: Number(e.target.value) })} className={inputCls} />
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={inputCls}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="jazzcash">JazzCash</option>
            <option value="easypaisa">Easypaisa</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
          <input placeholder="Reference / TRX ID" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputCls} />
          <button disabled={busy === 'add'} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2 transition-colors">
            {busy === 'add' ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-white/5">
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method / Reference</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {payments.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No payments recorded yet.</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{p.clinicName}</td>
                <td className="px-4 py-3 font-black text-gray-900 dark:text-white">{pkr(p.amountPKR)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {p.method.replace('_', ' ')}
                  {p.reference && <span className="text-xs text-gray-400"> · {p.reference}</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{String(p.createdAt).slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[p.status] || ''}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.status === 'submitted' && (
                    <div className="flex items-center justify-end gap-3">
                      {busy === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : (
                        <>
                          <button onClick={() => act(p.id, 'verify')} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" /> Verify
                          </button>
                          <button onClick={() => act(p.id, 'reject')} className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700">
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
