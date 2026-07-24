import { useState, useMemo, useEffect } from 'react';
import { Stethoscope, Plus, Clock, Pencil, Trash2, Star, Save, Loader2 } from 'lucide-react';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const categoryColors = {
  Cosmetic: '#ec4899', Restorative: '#3b82f6', Implantology: '#6366f1',
  Preventive: '#22c55e', Orthodontics: '#f59e0b', Consultation: '#0f766e',
  Endodontics: '#2563eb', Prosthodontics: '#7e22ce', 'Oral Surgery': '#f59e0b',
  Pediatric: '#0891b2',
};

const emptyForm = { name: '', category: '', price: '', defaultProcedureCost: '', duration: '', description: '', popular: false };

function ServiceFormModal({ isOpen, onClose, onSave, target, saving }) {
  const { term } = useClinic();
  const serviceLabel = term('service', 'Service');
  const treatmentLabel = term('treatment', 'Treatment');
  const isEdit = !!target;
  const [form, setForm] = useState(emptyForm);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (target) {
      setForm({
        name: target.name || '',
        category: target.category || '',
        price: target.price ?? '',
        defaultProcedureCost: target.defaultProcedureCost ?? '',
        duration: target.duration ?? '',
        description: target.description || '',
        popular: !!target.popular,
      });
    } else {
      setForm(emptyForm);
    }
    setValidationError('');
  }, [target, isOpen]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim() || form.price === '' || form.duration === '') {
      setValidationError('Name, price, and duration are required.');
      return;
    }
    setValidationError('');
    onSave({
      ...form,
      price: Number(form.price),
      defaultProcedureCost: form.defaultProcedureCost === '' ? null : Number(form.defaultProcedureCost),
      duration: Number(form.duration),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${serviceLabel}` : `Add New ${serviceLabel}`} size="md">
      <div className="space-y-4">
        {validationError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {validationError}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{serviceLabel} Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={`e.g. ${treatmentLabel}`}
            className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Category</label>
          <input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Cosmetic"
            className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Price (PKR) *</label>
            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="15000"
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Internal Cost (PKR)</label>
            <input type="number" value={form.defaultProcedureCost} onChange={e => set('defaultProcedureCost', e.target.value)} placeholder="40000"
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Duration (mins) *</label>
          <input type="number" value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="60"
            className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
            className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.popular} onChange={e => set('popular', e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700 dark:text-gray-200">Mark as Popular</span>
        </label>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" className="flex-1 justify-center" onClick={submit} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : `Add ${serviceLabel}`}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, name, deleting }) {
  const { term } = useClinic();
  const serviceLabel = term('service', 'Service');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Delete ${serviceLabel}`} size="sm">
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

function ServiceCard({ service, onEdit, onDelete }) {
  const catColor = categoryColors[service.category] || '#6366f1';

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5 hover:shadow-md hover:border-indigo-100 transition-all duration-200 group relative">
      {service.popular && (
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Star className="w-2.5 h-2.5 fill-current" /> Popular
          </span>
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: catColor + '15' }}>
          <Stethoscope className="w-4 h-4" style={{ color: catColor }} />
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors leading-snug">{service.name}</p>
          {service.category && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: catColor + '15', color: catColor }}>{service.category}</span>
            </div>
          )}
        </div>
      </div>

      {service.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4 line-clamp-2">{service.description}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-white/10">
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">PKR {Number(service.price).toLocaleString()}</p>
          <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
            <Clock className="w-3 h-3" />
            {service.duration} min
          </div>
          {service.defaultProcedureCost !== undefined && service.defaultProcedureCost !== null && service.defaultProcedureCost !== '' && (
            <p className="mt-1 text-[11px] font-semibold text-rose-600">Cost PKR {Number(service.defaultProcedureCost).toLocaleString()}</p>
          )}
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(service)}
            className="p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-white/10 text-gray-400 hover:text-indigo-600 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(service)}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Services() {
  const { term } = useClinic();
  const serviceLabel = term('service', 'Service');
  const servicesLabel = term('services', 'Services');
  const treatmentLabel = term('treatment', 'Treatment');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const loadServices = async () => {
    try {
      const data = await fetchApi('/services');
      setServices(Array.isArray(data) ? data : (data.services ?? data.data ?? []));
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadServices(); }, []);

  const handleSave = async (formData) => {
    setSaving(true);
    setError('');
    try {
      if (editTarget) {
        await fetchApi(`/services/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(formData) });
      } else {
        await fetchApi('/services', { method: 'POST', body: JSON.stringify(formData) });
      }
      setShowModal(false);
      setEditTarget(null);
      await loadServices();
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await fetchApi(`/services/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadServices();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => services, [services]);
  const categoryCount = new Set(services.map(s => s.category).filter(Boolean)).size;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Total ${servicesLabel}`, value: services.length, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-white/5' },
          { label: `${treatmentLabel} ${servicesLabel}`, value: services.length, color: 'text-teal-700', bg: 'bg-teal-50 dark:bg-teal-500/10' },
          { label: 'Categories', value: categoryCount, color: 'text-rose-700', bg: 'bg-rose-50 dark:bg-rose-500/10' },
          { label: 'Popular', value: services.filter(s => s.popular).length, color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="rounded-xl bg-gray-100 dark:bg-white/5 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {services.length} active {treatmentLabel.toLowerCase()} {servicesLabel.toLowerCase()}
        </div>
        <Button onClick={() => { setEditTarget(null); setShowModal(true); }} size="sm">
          <Plus className="w-4 h-4" /> Add {serviceLabel}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(service => (
          <ServiceCard key={service.id} service={service}
            onEdit={(s) => { setEditTarget(s); setShowModal(true); }}
            onDelete={(s) => setDeleteTarget(s)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400 text-sm">No {servicesLabel.toLowerCase()} found.</div>
        )}
      </div>

      <ServiceFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        onSave={handleSave}
        target={editTarget}
        saving={saving}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget?.name}
        deleting={deleting}
      />
    </div>
  );
}
