import { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, Edit2, Loader2, MapPin, Phone, Plus, RefreshCcw, Trash2, Users } from 'lucide-react';
import { fetchApi } from '../config/api';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const emptyForm = { name: '', address: '', phone: '', isActive: true };

function BranchModal({ isOpen, onClose, onSave, branch, saving }) {
  const [form, setForm] = useState(emptyForm);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setForm(branch ? {
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      isActive: branch.isActive !== false,
    } : emptyForm);
    setValidationError('');
  }, [branch, isOpen]);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.name.trim()) {
      setValidationError('Branch name is required.');
      return;
    }
    setValidationError('');
    onSave({ ...form, name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim() });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={branch ? `Edit ${branch.name}` : 'Add Branch'} size="md">
      <div className="space-y-4">
        {validationError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {validationError}
          </div>
        )}
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
          Branch Name
          <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] dark:border-white/10 dark:bg-slate-900"
            value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. DHA Lahore" />
        </label>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
          Address
          <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] dark:border-white/10 dark:bg-slate-900"
            value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, area, city" />
        </label>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
          Phone
          <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] dark:border-white/10 dark:bg-slate-900"
            value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92..." />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-xs font-bold text-gray-700 dark:border-white/10 dark:text-gray-200">
          <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
          Active branch
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {branch ? 'Save Changes' : 'Create Branch'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function MultiBranch() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState(null);

  const loadBranches = async () => {
    setLoading(true);
    setError('');
    try {
      setBranches(await fetchApi('/branches'));
    } catch (err) {
      setError(err.message || 'Could not load branches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBranches(); }, []);

  const stats = useMemo(() => ({
    total: branches.length,
    active: branches.filter(b => b.isActive).length,
    staff: branches.reduce((sum, b) => sum + Number(b._count?.staff || 0), 0),
    appointments: branches.reduce((sum, b) => sum + Number(b._count?.appointments || 0), 0),
  }), [branches]);

  const saveBranch = async (payload) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editBranch) {
        await fetchApi(`/branches/${editBranch.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await fetchApi('/branches', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      setEditBranch(null);
      await loadBranches();
    } catch (err) {
      setError(err.message || 'Branch could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBranch = async () => {
    if (!deleteBranchTarget) return;
    setError('');
    setNotice('');
    try {
      const result = await fetchApi(`/branches/${deleteBranchTarget.id}`, { method: 'DELETE' });
      setDeleteBranchTarget(null);
      await loadBranches();
      if (result?.deactivated) setNotice(result.message || 'Branch has linked records, so it was deactivated instead of deleted.');
    } catch (err) {
      setError(err.message || 'Branch could not be deleted.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branch Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">Create, edit, activate/deactivate and delete clinic branches from live data.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadBranches}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
          <Button onClick={() => { setEditBranch(null); setShowForm(true); }}><Plus className="h-4 w-4" /> Add Branch</Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{notice}</div>}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Total Branches', value: stats.total, icon: Building2 },
          { label: 'Active Branches', value: stats.active, icon: MapPin },
          { label: 'Assigned Staff', value: stats.staff, icon: Users },
          { label: 'Linked Appointments', value: stats.appointments, icon: Calendar },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{card.label}</p>
              <card.icon className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Branches</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading branches...</div>
        ) : branches.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No branches yet</p>
            <p className="mt-1 text-xs text-gray-400">Add your first live branch. No dummy branch data is shown.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  {['Branch', 'Contact', 'Staff', 'Appointments', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {branches.map(branch => (
                  <tr key={branch.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-5 py-4">
                      <p className="font-bold text-gray-900 dark:text-white">{branch.name}</p>
                      <p className="mt-1 flex items-start gap-1 text-xs text-gray-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {branch.address || 'No address saved'}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-300"><Phone className="mr-1 inline h-3 w-3" /> {branch.phone || 'No phone'}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{branch._count?.staff || 0}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{branch._count?.appointments || 0}</td>
                    <td className="px-5 py-4"><Badge label={branch.isActive ? 'active' : 'inactive'} variant={branch.isActive ? 'active' : 'inactive'} /></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditBranch(branch); setShowForm(true); }} className="rounded-lg p-2 text-gray-400 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteBranchTarget(branch)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BranchModal isOpen={showForm} onClose={() => { setShowForm(false); setEditBranch(null); }} onSave={saveBranch} branch={editBranch} saving={saving} />
      <Modal isOpen={!!deleteBranchTarget} onClose={() => setDeleteBranchTarget(null)} title="Delete Branch" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="text-sm font-bold">Delete or deactivate this branch?</p>
            <p className="mt-1 text-xs leading-5">
              {deleteBranchTarget?.name} will be deleted when possible. If it has linked records, the backend will deactivate it to preserve history.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteBranchTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={deleteBranch}><Trash2 className="h-4 w-4" /> Continue</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
