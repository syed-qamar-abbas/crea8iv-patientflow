import { useEffect, useState } from 'react';
import { Image, Loader2, Trash2, Upload } from 'lucide-react';
import { API_URL, fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import Button from '../components/ui/Button';

export default function Gallery() {
  const { term, features } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const galleryLabel = term('gallery', 'Gallery');
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchApi('/clients').then(rows => {
      const list = Array.isArray(rows) ? rows : (rows.clients || []);
      setClients(list);
      setClientId(list[0]?.id || '');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clientId) { setItems([]); return; }
    fetchApi(`/gallery/${clientId}`).then(setItems).catch(() => setItems([]));
  }, [clientId]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !clientId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('type', 'case');
      form.append('isPrivate', 'true');
      const token = localStorage.getItem('clinic_token');
      const response = await fetch(`${API_URL}/gallery/${clientId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!response.ok) throw new Error('Upload failed');
      setItems(await fetchApi(`/gallery/${clientId}`));
    } catch (err) {
      alert(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const remove = async (item) => {
    if (!confirm(`Delete this ${galleryLabel.toLowerCase()} item?`)) return;
    await fetchApi(`/gallery/${item.id}`, { method: 'DELETE' });
    setItems(await fetchApi(`/gallery/${clientId}`));
  };

  if (loading) return <div className="flex justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading {galleryLabel.toLowerCase()}...</div>;

  return (
    <div className="space-y-5">
      {!features.patientImagePublicationEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Patient media is stored as private operational documentation. Public publication is disabled until consent, retention, and withdrawal controls are implemented.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-bold text-gray-900 dark:text-white">{galleryLabel}</h1><p className="mt-1 text-sm text-gray-500">Private {patientLabel.toLowerCase()} files for authorized clinic operations.</p></div>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] px-4 py-2 text-sm font-medium text-white ${!clientId ? 'opacity-50' : ''}`}>
          <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" disabled={!clientId || uploading} onChange={upload} />
        </label>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <label className="text-xs font-bold text-gray-500">{patientLabel}</label>
        <select className="premium-input mt-1 w-full rounded-lg px-3 py-2 text-sm" value={clientId} onChange={e => setClientId(e.target.value)}>
          <option value="">Select {patientLabel.toLowerCase()}</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.patientNo ? `${client.patientNo} · ` : ''}{client.name}</option>)}
        </select>
      </div>
      {!clientId ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center"><Image className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="text-sm text-gray-400">Create/select a {patientLabel.toLowerCase()} to manage {galleryLabel.toLowerCase()} records.</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map(item => <div key={item.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"><img src={item.imageUrl} alt={item.service || 'Gallery item'} className="h-44 w-full object-cover" /><div className="p-3"><p className="text-xs font-bold">{item.service || item.type}</p><p className="mt-1 text-[11px] text-gray-500">{item.notes || 'No notes'}</p><Button variant="danger" size="sm" className="mt-3" onClick={() => remove(item)}><Trash2 className="h-4 w-4" /> Delete</Button></div></div>)}
          {items.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">No {galleryLabel.toLowerCase()} items for this {patientLabel.toLowerCase()}.</div>}
        </div>
      )}
    </div>
  );
}
