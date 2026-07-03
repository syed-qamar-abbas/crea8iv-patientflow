import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Grid, List, Plus, Phone, Mail, BadgeDollarSign, Loader2, Pencil, Trash2, Save } from 'lucide-react';
import { fetchApi, peekApiCacheByPrefix } from '../config/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useClinic } from '../context/ClinicContext';
import { canViewBusinessFinancials } from '../config/roles';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const tierColors = { Platinum: '#64748b', Gold: '#f59e0b', Silver: '#94a3b8', Bronze: '#f97316' };

const emptyForm = {
  name: '', phone: '', email: '', gender: 'Female', dob: '',
  loyaltyTier: 'Bronze', status: 'active',
};

function ClientFormModal({ isOpen, onClose, onSave, target, saving, term }) {
  const isEdit = !!target;
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (target) {
      setForm({
        name: target.name || '',
        phone: target.phone || '',
        email: target.email || '',
        gender: target.gender || 'Female',
        dob: target.dob ? String(target.dob).slice(0, 10) : '',
        loyaltyTier: target.loyaltyTier || 'Bronze',
        status: target.status || 'active',
      });
    } else {
      setForm(emptyForm);
    }
  }, [target, isOpen]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      alert('Name and phone are required.');
      return;
    }
    onSave(form);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${term('patient', 'Patient')}` : `Add New ${term('patient', 'Patient')}`} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Full Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ayesha Khan"
            className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone *</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92 300 0000000"
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Email</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com"
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Gender</label>
            <select value={form.gender} onChange={e => set('gender', e.target.value)}
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm">
              <option>Female</option><option>Male</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Date of Birth</label>
            <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)}
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Loyalty Tier</label>
            <select value={form.loyaltyTier} onChange={e => set('loyaltyTier', e.target.value)}
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm">
              <option>Bronze</option><option>Silver</option><option>Gold</option><option>Platinum</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm">
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" className="flex-1 justify-center" onClick={submit} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : `Add ${term('patient', 'Patient')}`}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, name, deleting, term }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Delete ${term('patient', 'Patient')}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Delete <span className="font-semibold">{name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={deleting}>
            <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ClientCard({ client, onClick, onEdit, onDelete }) {
  return (
    <div
      onClick={() => onClick(client.id)}
      className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-indigo-100 transition-all duration-200 group relative"
    >
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(client); }}
          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-white/10 text-gray-400 hover:text-indigo-600">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(client); }}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0"
            style={{ background: client.avatarColor || '#6366f1' }}
          >
            {client.initials || (client.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{client.name}</p>
            <p className="text-xs text-gray-400">{client.gender}{client.dob ? ` · ${new Date().getFullYear() - new Date(client.dob).getFullYear()} yrs` : ''}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Phone className="w-3 h-3 text-gray-400" />
          {client.phone}
        </div>
        {client.email && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Mail className="w-3 h-3 text-gray-400" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {client.patientNo && <Badge label={client.patientNo} variant="active" />}
        {client.loyaltyTier && <Badge label={client.loyaltyTier} variant={client.loyaltyTier} />}
      </div>

      <div className={`border-t border-gray-50 dark:border-white/10 pt-3 grid gap-2 ${canViewBusinessFinancials() ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {canViewBusinessFinancials() && (
          <div>
            <p className="text-xs text-gray-400">Total Spent</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">PKR {Number(client.totalSpent || 0).toLocaleString()}</p>
          </div>
        )}
        <div className={canViewBusinessFinancials() ? 'text-right' : ''}>
          <p className="text-xs text-gray-400">Loyalty Pts</p>
          <p className="text-sm font-bold text-indigo-600">{Number(client.loyaltyPoints || 0).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Due</p>
          <p className={`text-sm font-bold ${(client.outstandingBalance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            PKR {Number(client.outstandingBalance || 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const { term } = useClinic();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  // Seed from the last-seen cached list so a revisit renders instantly while the
  // fresh data loads in the background (stale-while-revalidate).
  const [clients, setClients] = useState(() => {
    const c = peekApiCacheByPrefix('/clients');
    return Array.isArray(c) ? c : (c?.clients ?? c?.data ?? []);
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadClients = async () => {
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
    });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (tierFilter !== 'all') params.set('tier', tierFilter);

    setLoading(true);
    try {
      const data = await fetchApi(`/clients?${params.toString()}`);
      // Defensive: backend returns { clients: [...] } but tolerate flat arrays too
      const list = Array.isArray(data) ? data : (data.clients ?? data.data ?? []);
      setClients(list);
      if (!Array.isArray(data)) {
        setPagination(current => ({
          ...current,
          total: Number(data.total || 0),
          page: Number(data.page || current.page),
          pages: Number(data.pages || 1),
        }));
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadClients(), search.trim() ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search, statusFilter, tierFilter]);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editTarget) {
        await fetchApi(`/clients/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(formData) });
      } else {
        await fetchApi('/clients', { method: 'POST', body: JSON.stringify(formData) });
      }
      setEditTarget(null);
      setShowAddModal(false);
      await loadClients();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchApi(`/clients/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadClients();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = clients;
  const goToPage = (nextPage) => {
    setPagination(current => ({ ...current, page: Math.min(Math.max(1, nextPage), current.pages || 1) }));
  };

  // Only show the skeleton on a true cold load (no cached data to show yet).
  if (loading && clients.length === 0) {
    return <div className="space-y-4"><TableSkeleton rows={8} cols={6} /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); goToPage(1); }}
              placeholder={`Search ${term('patient', 'patient').toLowerCase()} no, name, phone...`}
              className="pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); goToPage(1); }}
            className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-white/5">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); goToPage(1); }}
            className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-white/5">
            <option value="all">All Tiers</option>
            <option value="Platinum">Platinum</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
          </select>
          <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-0.5">
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <Button onClick={() => { setEditTarget(null); setShowAddModal(true); }} size="sm">
          <Plus className="w-4 h-4" /> New {term('patient', 'Patient')}
        </Button>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
        <span className="font-medium text-gray-700 dark:text-gray-200">Showing {filtered.length} of {pagination.total.toLocaleString()} {term('patients', 'patients').toLowerCase()}</span>
        <span>·</span>
        <span>{filtered.filter(c => c.status === 'active').length} active</span>
        {canViewBusinessFinancials() && (<>
          <span>·</span>
          <span className="text-indigo-600 font-medium">
            PKR {filtered.reduce((a, c) => a + Number(c.totalSpent || 0), 0).toLocaleString()} total revenue
          </span>
        </>)}
        <span>·</span>
        <span className="text-red-600 font-medium flex items-center gap-1">
          <BadgeDollarSign className="w-3.5 h-3.5" />
          PKR {filtered.reduce((a, c) => a + Number(c.outstandingBalance || 0), 0).toLocaleString()} due
        </span>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <ClientCard key={client.id} client={client}
              onClick={id => navigate(`/clients/${id}`)}
              onEdit={(c) => { setEditTarget(c); setShowAddModal(true); }}
              onDelete={(c) => setDeleteTarget(c)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No {term('patients', 'patients').toLowerCase()} match your filters</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
                {[term('patient', 'Patient'), `${term('patient', 'Patient')} No`, 'Contact', 'Tier', ...(canViewBusinessFinancials() ? ['Total Spent'] : []), 'Due', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/10">
              {filtered.map(client => (
                <tr key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="hover:bg-indigo-50/40 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: client.avatarColor || '#6366f1' }}>
                        {client.initials || (client.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-xs">{client.name}</p>
                        <p className="text-gray-400 text-[10px]">{client.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><p className="text-xs font-bold text-indigo-600">{client.patientNo || '—'}</p></td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs text-gray-700 dark:text-gray-200">{client.phone}</p>
                    <p className="text-[10px] text-gray-400">{client.email}</p>
                  </td>
                  <td className="px-4 py-3.5">{client.loyaltyTier && <Badge label={client.loyaltyTier} variant={client.loyaltyTier} />}</td>
                  {canViewBusinessFinancials() && <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-white text-xs">PKR {Number(client.totalSpent || 0).toLocaleString()}</td>}
                  <td className={`px-4 py-3.5 font-bold text-xs ${(client.outstandingBalance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>PKR {Number(client.outstandingBalance || 0).toLocaleString()}</td>
                  <td className="px-4 py-3.5">{client.status && <Badge label={client.status} variant={client.status} />}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditTarget(client); setShowAddModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-white/10 text-gray-400 hover:text-indigo-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(client); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No {term('patients', 'patients').toLowerCase()} found</div>
          )}
        </div>
      )}

      {pagination.total > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
          <span>Page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => goToPage(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}

      <ClientFormModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditTarget(null); }}
        onSave={handleSave}
        target={editTarget}
        saving={saving}
        term={term}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget?.name}
        deleting={deleting}
        term={term}
      />
    </div>
  );
}
