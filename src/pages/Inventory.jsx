import { useState, useEffect } from 'react';
import {
  Archive, Plus, AlertTriangle, Package, Layers, TrendingDown,
  Pencil, Trash2, Save, Loader2,
} from 'lucide-react';
import { fetchApi } from '../config/api';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const specialtyColors = { dental: 'dental' };

// Field naming: backend uses `quantity`; some legacy records may use `stock`
const getStock = (item) => Number(item.quantity ?? item.stock ?? 0);
const isLow = (item) => getStock(item) <= Number(item.reorderLevel ?? 0);
const isExpiringSoon = (item) => {
  if (!item.expiry) return false;
  const diff = (new Date(item.expiry) - new Date()) / (1000 * 60 * 60 * 24);
  return diff <= 30 && diff > 0;
};

const emptyForm = {
  name: '', category: '', specialty: 'dental', quantity: '', unit: 'units',
  reorderLevel: '', costPerUnit: '', supplier: '', expiry: '',
};

function ItemFormModal({ isOpen, onClose, onSave, target, saving }) {
  const isEdit = !!target;
  const [form, setForm] = useState(emptyForm);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (target) {
      setForm({
        name: target.name || '',
        category: target.category || '',
        specialty: target.specialty || 'dental',
        quantity: target.quantity ?? target.stock ?? '',
        unit: target.unit || 'units',
        reorderLevel: target.reorderLevel ?? '',
        costPerUnit: target.costPerUnit ?? '',
        supplier: target.supplier || '',
        expiry: target.expiry ? String(target.expiry).slice(0, 10) : '',
      });
    } else {
      setForm(emptyForm);
    }
    setValidationError('');
  }, [target, isOpen]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) {
      setValidationError('Item name is required.');
      return;
    }
    setValidationError('');
    onSave({
      ...form,
      quantity: Number(form.quantity || 0),
      reorderLevel: Number(form.reorderLevel || 0),
      costPerUnit: Number(form.costPerUnit || 0),
      expiry: form.expiry || null,
    });
  };

  const fields = [
    { label: 'Item Name *', key: 'name', type: 'text', colSpan: 2, placeholder: 'e.g. Composite Resin A2' },
    { label: 'Category', key: 'category', type: 'text', placeholder: 'e.g. Restorative' },
    { label: 'Specialty', key: 'specialty', type: 'text', placeholder: 'dental' },
    { label: 'Quantity', key: 'quantity', type: 'number', placeholder: '0' },
    { label: 'Unit', key: 'unit', type: 'text', placeholder: 'vials, syringes...' },
    { label: 'Reorder Level', key: 'reorderLevel', type: 'number', placeholder: '5' },
    { label: 'Cost Per Unit (PKR)', key: 'costPerUnit', type: 'number', placeholder: '1000' },
    { label: 'Supplier', key: 'supplier', type: 'text', colSpan: 2, placeholder: 'Supplier name' },
    { label: 'Expiry Date', key: 'expiry', type: 'date', colSpan: 2 },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'} size="lg">
      <div className="space-y-4">
        {validationError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {validationError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {fields.map(field => (
            <div key={field.key} className={field.colSpan === 2 ? 'col-span-2' : ''}>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">{field.label}</label>
              <input type={field.type} placeholder={field.placeholder}
                className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form[field.key]} onChange={e => set(field.key, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AdjustStockModal({ item, isOpen, onClose, onSubmit, saving }) {
  const [form, setForm] = useState({ reason: 'received', qty: 1, direction: '+' });
  useEffect(() => { if (isOpen) setForm({ reason: 'received', qty: 1, direction: '+' }); }, [isOpen]);
  if (!item) return null;
  const currentStock = getStock(item);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adjust Stock — ${item.name}`} size="sm">
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Current Stock</span>
          <span className="text-xl font-bold text-gray-900 dark:text-white">{currentStock} {item.unit}</span>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Adjustment Type</label>
          <div className="flex gap-2">
            {[{ val: '+', label: 'Add Stock' }, { val: '-', label: 'Remove Stock' }].map(d => (
              <button key={d.val} onClick={() => setForm(f => ({ ...f, direction: d.val }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.direction === d.val ? (d.val === '+' ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500') : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Quantity</label>
          <input type="number" min={1}
            className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">Reason</label>
          <select className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
            <option value="received">Received from supplier</option>
            <option value="used">Used in treatment</option>
            <option value="damaged">Damaged / Expired</option>
            <option value="adjustment">Manual adjustment</option>
          </select>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-3 text-sm">
          <span className="text-gray-600 dark:text-gray-300">New stock will be: </span>
          <span className="font-bold text-indigo-700">
            {Math.max(0, currentStock + (form.direction === '+' ? +form.qty : -form.qty))} {item.unit}
          </span>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSubmit({
            type: form.direction === '+' ? 'in' : 'out',
            quantity: Number(form.qty),
            reason: form.reason,
          })} disabled={saving}>{saving ? 'Saving...' : 'Confirm'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, name, deleting }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Item" size="sm">
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

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const loadItems = async () => {
    try {
      const data = await fetchApi('/inventory');
      setItems(Array.isArray(data) ? data : (data.items ?? data.data ?? []));
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  const handleSave = async (formData) => {
    setSaving(true);
    setError('');
    try {
      if (editTarget) {
        await fetchApi(`/inventory/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(formData) });
      } else {
        await fetchApi('/inventory', { method: 'POST', body: JSON.stringify(formData) });
      }
      setShowAdd(false);
      setEditTarget(null);
      await loadItems();
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
      // Backend has no DELETE; soft-delete via isActive flag
      await fetchApi(`/inventory/${deleteTarget.id}`, { method: 'PUT', body: JSON.stringify({ isActive: false }) });
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleAdjust = async (payload) => {
    if (!adjustItem) return;
    setSaving(true);
    setError('');
    try {
      await fetchApi(`/inventory/${adjustItem.id}/stock`, { method: 'POST', body: JSON.stringify(payload) });
      setAdjustItem(null);
      await loadItems();
    } catch (err) {
      setError(`Adjustment failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const lowCount = items.filter(isLow).length;
  const totalValue = items.reduce((a, i) => a + getStock(i) * Number(i.costPerUnit || 0), 0);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  const filtered = items.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (lowStockOnly && !isLow(item)) return false;
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track stock levels, suppliers, and reorder alerts</p>
        </div>
        <Button variant="primary" onClick={() => { setEditTarget(null); setShowAdd(true); }}>
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Items', value: items.length, icon: Archive, iconBg: 'bg-indigo-50 dark:bg-indigo-500/10', iconColor: 'text-indigo-600' },
          { label: 'Low Stock', value: lowCount, icon: AlertTriangle, iconBg: 'bg-red-50 dark:bg-red-500/10', iconColor: 'text-red-500', alert: true },
          { label: 'Total Value', value: `PKR ${(totalValue / 1000).toFixed(0)}k`, icon: TrendingDown, iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconColor: 'text-emerald-600' },
          { label: 'Categories', value: categories.length, icon: Layers, iconBg: 'bg-purple-50 dark:bg-purple-500/10', iconColor: 'text-purple-600' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{card.label}</p>
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              {card.alert && lowCount > 0 && (
                <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-full mb-0.5">Alert</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <select className="border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200 cursor-pointer ml-auto">
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)}
            className="w-4 h-4 accent-red-500 rounded" />
          Show Low Stock Only
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(item => {
          const low = isLow(item);
          const expiring = isExpiringSoon(item);
          const stock = getStock(item);
          return (
            <div key={item.id} className={`group bg-white dark:bg-white/5 rounded-xl border shadow-sm p-5 ${low ? 'border-red-200 dark:border-red-500/30' : 'border-gray-100 dark:border-white/10'} relative`}>
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditTarget(item); setShowAdd(true); }}
                  className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-white/10 text-gray-400 hover:text-indigo-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteTarget(item)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-start justify-between mb-3 pr-16">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{item.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {item.specialty && <Badge label={item.specialty} variant={specialtyColors[item.specialty]} />}
                    {item.category && <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{item.category}</span>}
                  </div>
                </div>
                <Package className={`w-5 h-5 shrink-0 mt-0.5 ${low ? 'text-red-400' : 'text-gray-300'}`} />
              </div>

              <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg mb-3 ${low ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-white/5'}`}>
                <div>
                  <p className={`text-lg font-bold ${low ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{stock} {item.unit}</p>
                  <p className="text-xs text-gray-400">Reorder at {item.reorderLevel}</p>
                </div>
                {low && (
                  <div className="flex items-center gap-1 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-semibold">Low Stock</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Cost per unit</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">PKR {Number(item.costPerUnit || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Total value</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">PKR {(stock * Number(item.costPerUnit || 0)).toLocaleString()}</span>
                </div>
                {item.supplier && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Supplier</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200 text-right max-w-[60%] truncate">{item.supplier}</span>
                  </div>
                )}
                {item.expiry && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Expiry</span>
                    <span className={`font-medium ${expiring ? 'text-amber-600' : 'text-gray-700 dark:text-gray-200'}`}>
                      {expiring && '⚠ '}{String(item.expiry).slice(0, 10)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => setAdjustItem(item)}
                  className="flex-1 py-2 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-90 text-white rounded-lg text-xs font-medium transition-opacity">
                  Adjust Stock
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-sm text-gray-400">No inventory items found.</div>
        )}
      </div>

      <ItemFormModal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setEditTarget(null); }}
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
      <AdjustStockModal
        item={adjustItem}
        isOpen={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        onSubmit={handleAdjust}
        saving={saving}
      />
    </div>
  );
}
