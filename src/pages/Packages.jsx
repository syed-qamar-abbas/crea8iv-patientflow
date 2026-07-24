import { useEffect, useState } from 'react';
import { Edit2, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { fetchApi } from '../config/api';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const emptyForm = { name: '', description: '', totalPrice: 0, validity: 30, specialty: 'dental' };
const money = (value = 0) => `PKR ${Number(value || 0).toLocaleString()}`;

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = async () => { setLoading(true); try { setPackages(await fetchApi('/packages')); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  useEffect(() => { setForm(editTarget ? { ...emptyForm, ...editTarget } : emptyForm); }, [editTarget, showForm]);

  const save = async () => {
    if (!form.name.trim()) {
      setError('Package name is required.');
      return;
    }
    setError('');
    const payload = { ...form, totalPrice: Number(form.totalPrice || 0), validity: Number(form.validity || 0) };
    try {
      if (editTarget) await fetchApi(`/packages/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await fetchApi('/packages', { method: 'POST', body: JSON.stringify(payload) });
      setShowForm(false); setEditTarget(null); await load();
    } catch (err) {
      setError(err.message || 'Package could not be saved.');
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await fetchApi(`/packages/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Package could not be deleted.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold text-gray-900 dark:text-white">Packages</h1><p className="mt-1 text-sm text-gray-500">Live package CRUD. No demo package data is shown.</p></div><Button onClick={() => { setEditTarget(null); setShowForm(true); }}><Plus className="h-4 w-4" /> New Package</Button></div>
      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}
      {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading packages...</div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {packages.map(pkg => <div key={pkg.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"><Package className="h-5 w-5 text-teal-700" /><h3 className="mt-3 font-black text-gray-950 dark:text-white">{pkg.name}</h3><p className="mt-1 text-xs text-gray-500">{pkg.description || 'No description'}</p><div className="mt-4 flex justify-between text-sm"><b>{money(pkg.totalPrice)}</b><span>{pkg.validity} days</span></div><div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" onClick={() => { setEditTarget(pkg); setShowForm(true); }}><Edit2 className="h-4 w-4" /> Edit</Button><Button variant="danger" size="sm" onClick={() => setDeleteTarget(pkg)}><Trash2 className="h-4 w-4" /> Delete</Button></div></div>)}
          {packages.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">No packages yet.</div>}
        </div>
      )}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditTarget(null); }} title={editTarget ? 'Edit Package' : 'New Package'} size="md">
        <div className="space-y-4">
          <input className="premium-input w-full rounded-lg px-3 py-2 text-sm" placeholder="Package name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <textarea className="premium-input w-full rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2"><input type="number" className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Total price" value={form.totalPrice} onChange={e => setForm({ ...form, totalPrice: e.target.value })} /><input type="number" className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Validity days" value={form.validity} onChange={e => setForm({ ...form, validity: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Package" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
            <p className="text-sm font-bold">Delete this package?</p>
            <p className="mt-1 text-xs leading-5">{deleteTarget?.name} will be removed from package selection.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
