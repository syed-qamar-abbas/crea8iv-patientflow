import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search, RefreshCcw, Download, Printer, MessageCircle, Trash2, Eye, Pill, X } from 'lucide-react';
import { fetchApi, API_URL, peekApiCacheByPrefix } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import PatientSearchSelect from '../components/ui/PatientSearchSelect';

const emptyMed = { name: '', dosage: '', frequency: '', duration: '', instructions: '' };
const emptyForm = {
  clientId: '', staffId: '', date: new Date().toISOString().slice(0, 10),
  doctorName: '', doctorQualification: '', doctorRegNo: '',
  diagnosis: '', clinicalNotes: '', medicines: [ { ...emptyMed } ],
  investigations: '', followUpDate: '', additionalNotes: '',
};

const ageFromDob = (dob) => {
  if (!dob) return '';
  const t = Date.parse(dob);
  if (Number.isNaN(t)) return '';
  const a = Math.floor((Date.now() - t) / 31557600000);
  return a >= 0 && a < 150 ? String(a) : '';
};

// Common frequency / instruction shortcuts speed up entry (Phase 2 will add a
// full drug autocomplete). Datalists keep it lightweight and template-agnostic.
const FREQUENCIES = ['Once daily (OD)', 'Twice daily (BD)', 'Three times a day (TID)', 'Four times a day (QID)', 'Every 6 hours', 'Every 8 hours', 'At night', 'SOS (as needed)'];
const INSTRUCTIONS = ['Before meals', 'After meals', 'With food', 'Empty stomach', 'Morning', 'Night', 'Morning & Night'];

function PrescriptionFormModal({ isOpen, onClose, onSaved, staff, clients, initialClientId }) {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setForm({ ...emptyForm, medicines: [ { ...emptyMed } ], clientId: initialClientId || '' }); setError(''); }
  }, [isOpen, initialClientId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMed = (i, k, v) => setForm(f => ({ ...f, medicines: f.medicines.map((m, idx) => idx === i ? { ...m, [k]: v } : m) }));
  const addMed = () => setForm(f => ({ ...f, medicines: [...f.medicines, { ...emptyMed }] }));
  const removeMed = (i) => setForm(f => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));

  // Picking a doctor prefills their name + qualification (editable).
  const chooseDoctor = (staffId) => {
    const s = staff.find(x => x.id === staffId);
    setForm(f => ({
      ...f, staffId,
      doctorName: s?.name || f.doctorName,
      doctorQualification: s?.qualifications || f.doctorQualification,
    }));
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30';

  const submit = async () => {
    if (!form.clientId) return setError(`${patientLabel} is required.`);
    const meds = form.medicines.filter(m => m.name.trim());
    setSaving(true); setError('');
    try {
      await fetchApi('/prescriptions', { method: 'POST', body: JSON.stringify({ ...form, medicines: meds }) });
      onSaved();
    } catch (e) {
      setError(e.message || 'Prescription could not be saved.');
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Prescription" size="xl">
      <div className="space-y-4">
        {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">{patientLabel} *
            <div className="mt-1">
              <PatientSearchSelect value={form.clientId} onChange={(id) => set('clientId', id)} fallbackClients={clients} inputClassName={inputCls} />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">{term('doctor', 'Doctor')}
              <select className={`mt-1 ${inputCls}`} value={form.staffId} onChange={e => chooseDoctor(e.target.value)}>
                <option value="">Select doctor…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Date
              <input type="date" className={`mt-1 ${inputCls}`} value={form.date} onChange={e => set('date', e.target.value)} />
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Doctor name
            <input className={`mt-1 ${inputCls}`} value={form.doctorName} onChange={e => set('doctorName', e.target.value)} placeholder="Dr. …" />
          </label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Qualification
            <input className={`mt-1 ${inputCls}`} value={form.doctorQualification} onChange={e => set('doctorQualification', e.target.value)} placeholder="BDS, RDS…" />
          </label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Reg. / License No (optional)
            <input className={`mt-1 ${inputCls}`} value={form.doctorRegNo} onChange={e => set('doctorRegNo', e.target.value)} />
          </label>
        </div>

        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Diagnosis / Chief Complaint
          <textarea rows={2} className={`mt-1 ${inputCls} resize-none`} value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} placeholder="e.g. Acute pulpitis, tooth #26" />
        </label>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Clinical Notes
          <textarea rows={2} className={`mt-1 ${inputCls} resize-none`} value={form.clinicalNotes} onChange={e => set('clinicalNotes', e.target.value)} />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200"><Pill className="h-3.5 w-3.5" /> Medications</label>
            <button type="button" onClick={addMed} className="flex items-center gap-1 text-xs font-bold text-[var(--primary)]"><Plus className="h-3.5 w-3.5" /> Add Medicine</button>
          </div>
          <datalist id="rx-freq">{FREQUENCIES.map(f => <option key={f} value={f} />)}</datalist>
          <datalist id="rx-instr">{INSTRUCTIONS.map(f => <option key={f} value={f} />)}</datalist>
          <div className="space-y-2">
            {form.medicines.map((m, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <input className={`col-span-12 sm:col-span-3 ${inputCls}`} placeholder="Medicine" value={m.name} onChange={e => setMed(i, 'name', e.target.value)} />
                <input className={`col-span-4 sm:col-span-2 ${inputCls}`} placeholder="Dosage" value={m.dosage} onChange={e => setMed(i, 'dosage', e.target.value)} />
                <input list="rx-freq" className={`col-span-4 sm:col-span-2 ${inputCls}`} placeholder="Frequency" value={m.frequency} onChange={e => setMed(i, 'frequency', e.target.value)} />
                <input className={`col-span-4 sm:col-span-2 ${inputCls}`} placeholder="Duration" value={m.duration} onChange={e => setMed(i, 'duration', e.target.value)} />
                <input list="rx-instr" className={`col-span-10 sm:col-span-2 ${inputCls}`} placeholder="Instructions" value={m.instructions} onChange={e => setMed(i, 'instructions', e.target.value)} />
                <button type="button" onClick={() => removeMed(i)} disabled={form.medicines.length === 1} className="col-span-2 sm:col-span-1 rounded-lg p-2 text-red-400 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Investigations / Lab Tests
            <textarea rows={2} className={`mt-1 ${inputCls} resize-none`} value={form.investigations} onChange={e => set('investigations', e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Follow-up Date
              <input type="date" className={`mt-1 ${inputCls}`} value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
            </label>
          </div>
        </div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Additional Notes
          <textarea rows={2} className={`mt-1 ${inputCls} resize-none`} value={form.additionalNotes} onChange={e => set('additionalNotes', e.target.value)} />
        </label>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1 justify-center" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Prescription'}</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function PrescriptionViewModal({ rx, isOpen, onClose }) {
  if (!rx) return null;
  const meds = Array.isArray(rx.medicines) ? rx.medicines : [];
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={rx.prescriptionNo || 'Prescription'} size="lg">
      <div className="space-y-3 text-sm">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
          <p className="font-bold text-gray-900 dark:text-white">{rx.clientName}</p>
          <p className="text-xs text-gray-500">
            {ageFromDob(rx.clientDob) && `Age ${ageFromDob(rx.clientDob)} · `}
            {rx.clientGender ? `${rx.clientGender} · ` : ''}{rx.clientPatientNo || ''} · {rx.date}
          </p>
          {rx.doctorName && <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-200">{rx.doctorName}{rx.doctorQualification ? ` — ${rx.doctorQualification}` : ''}</p>}
        </div>
        {rx.diagnosis && <div><p className="text-xs font-bold uppercase text-[var(--primary)]">Diagnosis</p><p>{rx.diagnosis}</p></div>}
        {rx.clinicalNotes && <div><p className="text-xs font-bold uppercase text-[var(--primary)]">Clinical Notes</p><p>{rx.clinicalNotes}</p></div>}
        {meds.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase text-[var(--primary)]">Medications</p>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-gray-400"><th className="py-1 pr-2">Medicine</th><th className="pr-2">Dosage</th><th className="pr-2">Frequency</th><th className="pr-2">Duration</th><th>Instructions</th></tr></thead>
                <tbody>
                  {meds.map((m, i) => <tr key={i} className="border-t border-gray-100 dark:border-white/10"><td className="py-1 pr-2 font-semibold">{m.name}</td><td className="pr-2">{m.dosage}</td><td className="pr-2">{m.frequency}</td><td className="pr-2">{m.duration}</td><td>{m.instructions}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {rx.investigations && <div><p className="text-xs font-bold uppercase text-[var(--primary)]">Investigations</p><p>{rx.investigations}</p></div>}
        {rx.followUpDate && <div><p className="text-xs font-bold uppercase text-[var(--primary)]">Follow-up</p><p>{rx.followUpDate}</p></div>}
        {rx.additionalNotes && <div><p className="text-xs font-bold uppercase text-[var(--primary)]">Additional Notes</p><p>{rx.additionalNotes}</p></div>}
      </div>
    </Modal>
  );
}

export default function Prescriptions() {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(() => { const c = peekApiCacheByPrefix('/prescriptions'); return Array.isArray(c) ? c : []; });
  const [staff, setStaff] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewRx, setViewRx] = useState(null);
  const [error, setError] = useState('');
  const [prefillClientId, setPrefillClientId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rx, st, cl] = await Promise.all([
        fetchApi(`/prescriptions${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`),
        fetchApi('/staff').catch(() => []),
        fetchApi('/clients?limit=20').catch(() => ({ clients: [] })),
      ]);
      setRows(Array.isArray(rx) ? rx : []);
      setStaff((Array.isArray(st) ? st : (st.staff || [])).filter(s => s.status !== 'inactive'));
      setClients(Array.isArray(cl) ? cl : (cl.clients || []));
    } catch (e) { setError(e.message || 'Could not load prescriptions.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  // Deep-link from a patient profile: /prescriptions?new=1&clientId=…
  useEffect(() => {
    if (params.get('new') === '1') {
      setPrefillClientId(params.get('clientId') || '');
      setShowForm(true);
      params.delete('new'); params.delete('clientId'); setParams(params, { replace: true });
    }
    // eslint-disable-next-line
  }, []);

  const filtered = rows;

  const fetchPdfBlobUrl = async (rx) => {
    const token = localStorage.getItem('clinic_token');
    const response = await fetch(`${API_URL}/prescriptions/${rx.id}/pdf?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) { let m = 'PDF could not be generated.'; try { const j = await response.json(); if (j.error) m = j.error; } catch (_) {} throw new Error(m); }
    return URL.createObjectURL(await response.blob());
  };
  const downloadPdf = async (rx) => { try { const u = await fetchPdfBlobUrl(rx); const a = document.createElement('a'); a.href = u; a.download = `${rx.prescriptionNo || 'prescription'}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000); } catch (e) { setError(e.message); } };
  const printPdf = async (rx) => { try { const u = await fetchPdfBlobUrl(rx); const w = window.open(u, '_blank'); if (w) w.addEventListener('load', () => { try { w.print(); } catch (_) {} }); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch (e) { setError(e.message); } };
  const sendWhatsapp = (rx) => {
    let phone = (rx.clientPhone || '').replace(/\D/g, '');
    if (!phone) return setError(`No WhatsApp number for this ${patientLabel.toLowerCase()}.`);
    if (phone.startsWith('0')) phone = '92' + phone.slice(1);
    const msg = `Hi ${rx.clientName || patientLabel}, please find your prescription (${rx.prescriptionNo}) from ${rx.date}. Kindly follow the dosage and instructions as advised.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const cancelRx = async (rx) => {
    if (!confirm(`Cancel prescription ${rx.prescriptionNo}? It will be removed from the active list.`)) return;
    try { await fetchApi(`/prescriptions/${rx.id}`, { method: 'DELETE' }); loadData(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white"><FileText className="h-5 w-5" /> Prescriptions</h1>
          <p className="mt-0.5 text-sm text-gray-500">Create, save, print, and share {patientLabel.toLowerCase()} prescriptions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadData}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
          <Button onClick={() => { setPrefillClientId(''); setShowForm(true); }} data-training="prescriptions-new-button"><Plus className="h-4 w-4" /> New Prescription</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10">{error}</div>}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadData()}
          placeholder={`Search by ${patientLabel.toLowerCase()}, phone, Rx no, or diagnosis…`}
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-white/10 dark:bg-white/5" data-training="prescription-list">
        <div className="hidden grid-cols-12 gap-2 border-b border-gray-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:border-white/10 sm:grid">
          <div className="col-span-3">Rx #</div><div className="col-span-3">{patientLabel}</div><div className="col-span-3">Diagnosis</div><div className="col-span-1">Date</div><div className="col-span-2 text-right">Actions</div>
        </div>
        {loading && rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <FileText className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-semibold text-gray-500">No prescriptions yet</p>
            <p className="text-xs text-gray-400">Click “New Prescription” to create the first one.</p>
          </div>
        ) : filtered.map(rx => (
          <div key={rx.id} className="grid grid-cols-2 items-center gap-2 border-b border-gray-50 px-4 py-3 last:border-0 dark:border-white/5 sm:grid-cols-12">
            <div className="col-span-2 sm:col-span-3">
              <button onClick={() => setViewRx(rx)} className="font-bold text-[var(--primary)] hover:underline">{rx.prescriptionNo}</button>
              <p className="text-[11px] text-gray-400 sm:hidden">{rx.clientName} · {rx.date}</p>
            </div>
            <div className="hidden sm:col-span-3 sm:block"><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{rx.clientName}</p><p className="text-[11px] text-gray-400">{rx.clientPatientNo}</p></div>
            <div className="hidden truncate text-sm text-gray-600 dark:text-gray-300 sm:col-span-3 sm:block">{rx.diagnosis || '—'}</div>
            <div className="hidden text-xs text-gray-500 sm:col-span-1 sm:block">{rx.date}</div>
            <div className="col-span-2 flex justify-end gap-1 sm:col-span-2">
              <button onClick={() => setViewRx(rx)} title="View" className="rounded-lg p-1.5 text-gray-400 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"><Eye className="h-3.5 w-3.5" /></button>
              <button onClick={() => downloadPdf(rx)} title="Download PDF" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Download className="h-3.5 w-3.5" /></button>
              <button onClick={() => printPdf(rx)} title="Print" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Printer className="h-3.5 w-3.5" /></button>
              <button onClick={() => sendWhatsapp(rx)} title="Share on WhatsApp" className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600"><MessageCircle className="h-3.5 w-3.5" /></button>
              <button onClick={() => cancelRx(rx)} title="Cancel" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <PrescriptionFormModal isOpen={showForm} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadData(); }} staff={staff} clients={clients} initialClientId={prefillClientId} />
      <PrescriptionViewModal rx={viewRx} isOpen={!!viewRx} onClose={() => setViewRx(null)} />
    </div>
  );
}
