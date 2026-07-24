import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Plus, Loader2, Search, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import PatientSearchSelect from '../components/ui/PatientSearchSelect';

const STATUS = {
  sent: { label: 'At lab', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  received: { label: 'Received', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  fitted: { label: 'Fitted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
};
const FILTERS = [['all', 'All'], ['sent', 'At lab'], ['overdue', 'Overdue'], ['received', 'Received'], ['fitted', 'Fitted']];
const today = () => new Date().toISOString().slice(0, 10);
const isOverdue = (c) => c.status === 'sent' && c.dueDate && c.dueDate < today();
const inputCls = 'w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40';
const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1';

export default function Lab() {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const treatmentLabel = term('treatment', term('service', 'Service'));
  const labLabel = term('lab', 'Lab');
  const [cases, setCases] = useState(null);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null); // case being edited, or 'new'
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (search.trim()) params.set('search', search.trim());
    return fetchApi(`/lab?${params.toString()}`).then((d) => { setCases(d.cases || []); setCounts(d.counts || {}); }).catch((e) => setError(e.message));
  };
  useEffect(() => { const t = setTimeout(load, search ? 250 : 0); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [filter, search]);

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await fetchApi(`/lab/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      load();
    } catch (e) { setError(e.message); }
  };
  const quickStatus = async (c, status) => { try { await fetchApi(`/lab/${c.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); load(); } catch (e) { setError(e.message); } };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><FlaskConical className="h-5 w-5 text-[var(--primary)]" /> {labLabel} Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">Track outside work, due dates, and overdue follow-ups.</p>
        </div>
        <Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> New {labLabel} Case</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['At lab', counts.sent || 0, 'text-amber-600'], ['Overdue', counts.overdue || 0, 'text-rose-600'], ['Received', counts.received || 0, 'text-sky-600'], ['Fitted', counts.fitted || 0, 'text-emerald-600']].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{l}</p>
            <p className={`mt-1 text-2xl font-black ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white" placeholder={`Search ${patientLabel.toLowerCase()}, ${labLabel.toLowerCase()}, ${treatmentLabel.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${filter === k ? 'border-transparent bg-[var(--primary)] text-white' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'}`}>
              {l}{k === 'overdue' && counts.overdue ? ` (${counts.overdue})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        {!cases ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--primary)]" /></div>
        ) : cases.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">No {labLabel.toLowerCase()} cases{filter !== 'all' ? ' in this view' : ' yet'}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-3">{patientLabel}</th><th className="px-4 py-3">{labLabel}</th><th className="px-4 py-3">{treatmentLabel}</th>
                <th className="px-4 py-3">Sent</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {cases.map((c) => (
                  <tr key={c.id} className={isOverdue(c) ? 'bg-rose-50/40 dark:bg-rose-900/10' : ''}>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{c.patientName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.labName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.procedure || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{(c.sentDate || '').slice(0, 10) || '—'}</td>
                    <td className="px-4 py-3">{c.dueDate ? <span className={isOverdue(c) ? 'font-bold text-rose-600' : 'text-gray-600 dark:text-gray-300'}>{isOverdue(c) && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}{c.dueDate.slice(0, 10)}</span> : <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <select value={c.status} onChange={(e) => quickStatus(c, e.target.value)} className={`rounded-lg px-2 py-1 text-xs font-bold border-0 ${(STATUS[c.status] || {}).cls}`}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEdit(c)} title="Edit" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[var(--primary)] dark:hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteTarget(c)} title="Delete" className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && <LabModal labCase={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`Delete ${labLabel} Case`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Delete this {labLabel.toLowerCase()} case for {deleteTarget?.patientName || 'this patient'}?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Keep Case</Button>
            <Button variant="danger" onClick={remove}>Delete Case</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LabModal({ labCase, onClose, onSaved }) {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const doctorLabel = term('doctor', 'Doctor');
  const treatmentLabel = term('treatment', term('service', 'Service'));
  const labLabel = term('lab', 'Lab');
  const isEdit = !!labCase;
  const [f, setF] = useState({
    clientId: labCase?.clientId || '', patientName: labCase?.patientName || '', labName: labCase?.labName || '',
    procedure: labCase?.procedure || '', itemsSent: labCase?.itemsSent || '', shade: labCase?.shade || '',
    doctorName: labCase?.doctorName || '', sentDate: (labCase?.sentDate || today()).slice(0, 10),
    dueDate: (labCase?.dueDate || '').slice(0, 10), cost: labCase?.cost || '', status: labCase?.status || 'sent', notes: labCase?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.labName.trim()) { setErr('Lab name is required'); return; }
    setSaving(true); setErr('');
    try {
      const body = { ...f, cost: Number(f.cost) || 0 };
      if (isEdit) await fetchApi(`/lab/${labCase.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await fetchApi('/lab', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? `Edit ${labLabel} Case` : `New ${labLabel} Case`} size="md">
      <div className="space-y-3">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <div>
          <label className={labelCls}>{patientLabel}</label>
          <PatientSearchSelect value={f.clientId} initialLabel={f.patientName} onChange={(id, p) => { set('clientId', id); if (p?.name) set('patientName', p.name); }} inputClassName={inputCls} />
          <input className={`${inputCls} mt-2`} placeholder="Or type a name (walk-in / not registered)" value={f.patientName} onChange={(e) => set('patientName', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>{labLabel} name *</label><input className={inputCls} value={f.labName} onChange={(e) => set('labName', e.target.value)} placeholder={`e.g. ${labLabel} Partner`} /></div>
          <div><label className={labelCls}>{treatmentLabel}</label><input className={inputCls} value={f.procedure} onChange={(e) => set('procedure', e.target.value)} placeholder={`e.g. ${treatmentLabel} details`} /></div>
          <div><label className={labelCls}>Shade</label><input className={inputCls} value={f.shade} onChange={(e) => set('shade', e.target.value)} placeholder="e.g. A2" /></div>
          <div><label className={labelCls}>{doctorLabel}</label><input className={inputCls} value={f.doctorName} onChange={(e) => set('doctorName', e.target.value)} /></div>
          <div><label className={labelCls}>Sent date</label><input type="date" className={inputCls} value={f.sentDate} onChange={(e) => set('sentDate', e.target.value)} /></div>
          <div><label className={labelCls}>Due date</label><input type="date" className={inputCls} value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
          <div><label className={labelCls}>Cost (PKR)</label><input type="number" className={inputCls} value={f.cost} onChange={(e) => set('cost', e.target.value)} /></div>
          <div><label className={labelCls}>Status</label>
            <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div><label className={labelCls}>Items sent to {labLabel.toLowerCase()}</label><input className={inputCls} value={f.itemsSent} onChange={(e) => set('itemsSent', e.target.value)} placeholder="Reference items, files, or assets" /></div>
        <div><label className={labelCls}>Notes</label><textarea rows={2} className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !f.labName.trim()}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : `Add ${labLabel.toLowerCase()} case`)}</Button>
        </div>
      </div>
    </Modal>
  );
}
