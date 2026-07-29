import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search, RefreshCcw, Download, Printer, MessageCircle, Trash2, Eye, Pill, Copy, Pencil, BookmarkPlus, CalendarClock } from 'lucide-react';
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

const FREQUENCIES = ['Once daily (OD)', 'Twice daily (BD)', 'Three times a day (TID)', 'Four times a day (QID)', 'Every 6 hours', 'Every 8 hours', 'At night', 'SOS (as needed)'];
const INSTRUCTIONS = ['Before meals', 'After meals', 'With food', 'Empty stomach', 'Morning', 'Night', 'Morning & Night'];
// Starter common drugs — merged with the clinic's own frequently-prescribed list.
const COMMON_DRUGS = ['Amoxicillin 500mg', 'Augmentin 625mg', 'Metronidazole 400mg', 'Azithromycin 500mg', 'Ibuprofen 400mg', 'Paracetamol 500mg', 'Diclofenac 50mg', 'Ponstan 500mg', 'Ciprofloxacin 500mg', 'Chlorhexidine mouthwash', 'Omeprazole 20mg'];

const rxToForm = (rx, { asNew = false } = {}) => ({
  clientId: rx.clientId || '',
  staffId: rx.staffId || '',
  date: asNew ? new Date().toISOString().slice(0, 10) : (rx.date || new Date().toISOString().slice(0, 10)),
  doctorName: rx.doctorName || '',
  doctorQualification: rx.doctorQualification || '',
  doctorRegNo: rx.doctorRegNo || '',
  diagnosis: rx.diagnosis || '',
  clinicalNotes: rx.clinicalNotes || '',
  medicines: (Array.isArray(rx.medicines) && rx.medicines.length) ? rx.medicines.map(m => ({ ...emptyMed, ...m })) : [ { ...emptyMed } ],
  investigations: rx.investigations || '',
  followUpDate: asNew ? '' : (rx.followUpDate || ''),
  additionalNotes: rx.additionalNotes || '',
});

function PrescriptionFormModal({ isOpen, onClose, onSaved, staff, clients, initialClientId, editRx, duplicateFrom, templates, suggestions, onTemplateSaved }) {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const isEdit = !!editRx;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editRx) setForm(rxToForm(editRx));
    else if (duplicateFrom) setForm(rxToForm(duplicateFrom, { asNew: true }));
    else setForm({ ...emptyForm, medicines: [ { ...emptyMed } ], clientId: initialClientId || '' });
  }, [isOpen, editRx, duplicateFrom, initialClientId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMed = (i, k, v) => setForm(f => ({ ...f, medicines: f.medicines.map((m, idx) => idx === i ? { ...m, [k]: v } : m) }));
  const addMed = () => setForm(f => ({ ...f, medicines: [...f.medicines, { ...emptyMed }] }));
  const removeMed = (i) => setForm(f => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));

  // When a medicine name matches a known suggestion, prefill empty fields with
  // that drug's most common dosage/frequency/duration/instructions.
  const onMedName = (i, val) => {
    const hit = suggestions.find(s => s.name.toLowerCase() === val.trim().toLowerCase());
    setForm(f => ({ ...f, medicines: f.medicines.map((m, idx) => {
      if (idx !== i) return m;
      const next = { ...m, name: val };
      if (hit) {
        if (!next.dosage) next.dosage = hit.dosage || '';
        if (!next.frequency) next.frequency = hit.frequency || '';
        if (!next.duration) next.duration = hit.duration || '';
        if (!next.instructions) next.instructions = hit.instructions || '';
      }
      return next;
    }) }));
  };

  const chooseDoctor = (staffId) => {
    const s = staff.find(x => x.id === staffId);
    setForm(f => ({ ...f, staffId, doctorName: s?.name || f.doctorName, doctorQualification: s?.qualifications || f.doctorQualification }));
  };

  const applyTemplate = (tplId) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    setForm(f => ({
      ...f,
      diagnosis: tpl.diagnosis || f.diagnosis,
      investigations: tpl.investigations || f.investigations,
      additionalNotes: tpl.additionalNotes || f.additionalNotes,
      medicines: (Array.isArray(tpl.medicines) && tpl.medicines.length) ? tpl.medicines.map(m => ({ ...emptyMed, ...m })) : f.medicines,
    }));
  };

  const saveAsTemplate = async () => {
    const meds = form.medicines.filter(m => m.name.trim());
    if (!meds.length && !form.diagnosis.trim()) return setError('Add a diagnosis or at least one medicine before saving a template.');
    const name = window.prompt('Template name (e.g. "Post-extraction pack"):');
    if (!name || !name.trim()) return;
    try {
      const tpl = await fetchApi('/prescription-templates', { method: 'POST', body: JSON.stringify({ name: name.trim(), diagnosis: form.diagnosis, medicines: meds, investigations: form.investigations, additionalNotes: form.additionalNotes }) });
      onTemplateSaved?.(tpl);
    } catch (e) { setError(e.message || 'Could not save template.'); }
  };

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30';

  const submit = async () => {
    if (!form.clientId) return setError(`${patientLabel} is required.`);
    const meds = form.medicines.filter(m => m.name.trim());
    setSaving(true); setError('');
    try {
      if (isEdit) await fetchApi(`/prescriptions/${editRx.id}`, { method: 'PUT', body: JSON.stringify({ ...form, medicines: meds }) });
      else await fetchApi('/prescriptions', { method: 'POST', body: JSON.stringify({ ...form, medicines: meds }) });
      onSaved();
    } catch (e) { setError(e.message || 'Prescription could not be saved.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${editRx.prescriptionNo}` : (duplicateFrom ? 'Duplicate Prescription' : 'New Prescription')} size="xl">
      <div className="space-y-4">
        {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">{patientLabel} *
            <div className="mt-1">
              {isEdit ? (
                <input disabled value={editRx.clientName || ''} className={`${inputCls} opacity-70`} />
              ) : (
                <PatientSearchSelect value={form.clientId} onChange={(id) => set('clientId', id)} fallbackClients={clients} inputClassName={inputCls} />
              )}
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

        {templates.length > 0 && (
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Load a template
            <select className={`mt-1 ${inputCls}`} value="" onChange={e => { applyTemplate(e.target.value); e.target.value = ''; }}>
              <option value="">Apply a saved template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}

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
            <div className="flex items-center gap-3">
              <button type="button" onClick={saveAsTemplate} className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[var(--primary)]"><BookmarkPlus className="h-3.5 w-3.5" /> Save as template</button>
              <button type="button" onClick={addMed} className="flex items-center gap-1 text-xs font-bold text-[var(--primary)]"><Plus className="h-3.5 w-3.5" /> Add Medicine</button>
            </div>
          </div>
          <datalist id="rx-meds">{[...new Set([...suggestions.map(s => s.name), ...COMMON_DRUGS])].map(n => <option key={n} value={n} />)}</datalist>
          <datalist id="rx-freq">{FREQUENCIES.map(f => <option key={f} value={f} />)}</datalist>
          <datalist id="rx-instr">{INSTRUCTIONS.map(f => <option key={f} value={f} />)}</datalist>
          <div className="space-y-2">
            {form.medicines.map((m, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <input list="rx-meds" className={`col-span-12 sm:col-span-3 ${inputCls}`} placeholder="Medicine" value={m.name} onChange={e => onMedName(i, e.target.value)} />
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
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Follow-up Date
            <input type="date" className={`mt-1 ${inputCls}`} value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
          </label>
        </div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">Additional Notes
          <textarea rows={2} className={`mt-1 ${inputCls} resize-none`} value={form.additionalNotes} onChange={e => set('additionalNotes', e.target.value)} />
        </label>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1 justify-center" onClick={submit} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save Prescription')}</Button>
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
  const [templates, setTemplates] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [followUpsOnly, setFollowUpsOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRx, setEditRx] = useState(null);
  const [duplicateFrom, setDuplicateFrom] = useState(null);
  const [viewRx, setViewRx] = useState(null);
  const [error, setError] = useState('');
  const [prefillClientId, setPrefillClientId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rx, st, cl, tpl, sug] = await Promise.all([
        fetchApi(`/prescriptions${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`),
        fetchApi('/staff').catch(() => []),
        fetchApi('/clients?limit=20').catch(() => ({ clients: [] })),
        fetchApi('/prescription-templates').catch(() => []),
        fetchApi('/prescriptions/medicine-suggestions').catch(() => []),
      ]);
      setRows(Array.isArray(rx) ? rx : []);
      setStaff((Array.isArray(st) ? st : (st.staff || [])).filter(s => s.status !== 'inactive'));
      setClients(Array.isArray(cl) ? cl : (cl.clients || []));
      setTemplates(Array.isArray(tpl) ? tpl : []);
      setSuggestions(Array.isArray(sug) ? sug : []);
    } catch (e) { setError(e.message || 'Could not load prescriptions.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (params.get('new') === '1') {
      setPrefillClientId(params.get('clientId') || '');
      setEditRx(null); setDuplicateFrom(null); setShowForm(true);
      params.delete('new'); params.delete('clientId'); setParams(params, { replace: true });
    }
    // eslint-disable-next-line
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => followUpsOnly ? rows.filter(r => r.followUpDate && r.followUpDate >= today) : rows, [rows, followUpsOnly, today]);

  const openNew = () => { setEditRx(null); setDuplicateFrom(null); setPrefillClientId(''); setShowForm(true); };
  const openEdit = (rx) => { setEditRx(rx); setDuplicateFrom(null); setShowForm(true); };
  const openDuplicate = (rx) => { setDuplicateFrom(rx); setEditRx(null); setShowForm(true); };

  const fetchPdfBlob = async (rx) => {
    const token = localStorage.getItem('clinic_token');
    const response = await fetch(`${API_URL}/prescriptions/${rx.id}/pdf?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) { let m = 'PDF could not be generated.'; try { const j = await response.json(); if (j.error) m = j.error; } catch (_) {} throw new Error(m); }
    return response.blob();
  };
  const fetchPdfBlobUrl = async (rx) => URL.createObjectURL(await fetchPdfBlob(rx));
  const downloadPdf = async (rx) => { try { const u = await fetchPdfBlobUrl(rx); const a = document.createElement('a'); a.href = u; a.download = `${rx.prescriptionNo || 'prescription'}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000); } catch (e) { setError(e.message); } };
  const printPdf = async (rx) => { try { const u = await fetchPdfBlobUrl(rx); const w = window.open(u, '_blank'); if (w) w.addEventListener('load', () => { try { w.print(); } catch (_) {} }); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch (e) { setError(e.message); } };

  // WhatsApp share WITHOUT the Business API:
  // • Mobile/tablet — the native OS share sheet with the PDF already attached, so
  //   the user just picks WhatsApp + the patient and hits send (one real step).
  // • Desktop (no file-share support) — download the PDF (ready to attach) and
  //   open the WhatsApp chat with a prefilled message.
  const sendWhatsapp = async (rx) => {
    let phone = (rx.clientPhone || '').replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.slice(1);
    const msg = `Hi ${rx.clientName || patientLabel}, please find your prescription (${rx.prescriptionNo}) from ${rx.date}. Kindly follow the dosage and instructions as advised.`;
    let blob;
    try { blob = await fetchPdfBlob(rx); } catch (e) { return setError(e.message); }
    const file = new File([blob], `${rx.prescriptionNo || 'prescription'}.pdf`, { type: 'application/pdf' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: rx.prescriptionNo || 'Prescription', text: msg }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* not supported/blocked → fall back */ }
    }
    // Fallback: download the PDF, then open the WhatsApp chat to attach it.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    else setError(`No WhatsApp number for this ${patientLabel.toLowerCase()}. The PDF was downloaded so you can attach it manually.`);
  };
  const cancelRx = async (rx) => {
    if (!confirm(`Cancel prescription ${rx.prescriptionNo}? It will be removed from the active list.`)) return;
    try { await fetchApi(`/prescriptions/${rx.id}`, { method: 'DELETE' }); loadData(); } catch (e) { setError(e.message); }
  };

  const followUpCount = rows.filter(r => r.followUpDate && r.followUpDate >= today).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white"><FileText className="h-5 w-5" /> Prescriptions</h1>
          <p className="mt-0.5 text-sm text-gray-500">Create, save, print, and share {patientLabel.toLowerCase()} prescriptions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadData}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
          <Button onClick={openNew} data-training="prescriptions-new-button"><Plus className="h-4 w-4" /> New Prescription</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10">{error}</div>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadData()}
            placeholder={`Search by ${patientLabel.toLowerCase()}, phone, Rx no, or diagnosis…`}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white" />
        </div>
        <button onClick={() => setFollowUpsOnly(v => !v)}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold ${followUpsOnly ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'}`}>
          <CalendarClock className="h-4 w-4" /> Follow-ups due{followUpCount ? ` (${followUpCount})` : ''}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-white/10 dark:bg-white/5" data-training="prescription-list">
        <div className="hidden grid-cols-12 gap-2 border-b border-gray-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:border-white/10 sm:grid">
          <div className="col-span-2">Rx #</div><div className="col-span-3">{patientLabel}</div><div className="col-span-3">Diagnosis</div><div className="col-span-1">Date</div><div className="col-span-1">Follow-up</div><div className="col-span-2 text-right">Actions</div>
        </div>
        {loading && rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <FileText className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-semibold text-gray-500">{followUpsOnly ? 'No upcoming follow-ups' : 'No prescriptions yet'}</p>
            <p className="text-xs text-gray-400">{followUpsOnly ? 'Prescriptions with a future follow-up date appear here.' : 'Click “New Prescription” to create the first one.'}</p>
          </div>
        ) : filtered.map(rx => (
          <div key={rx.id} className="grid grid-cols-2 items-center gap-2 border-b border-gray-50 px-4 py-3 last:border-0 dark:border-white/5 sm:grid-cols-12">
            <div className="col-span-2 sm:col-span-2">
              <button onClick={() => setViewRx(rx)} className="font-bold text-[var(--primary)] hover:underline">{rx.prescriptionNo}</button>
              <p className="text-[11px] text-gray-400 sm:hidden">{rx.clientName} · {rx.date}</p>
            </div>
            <div className="hidden sm:col-span-3 sm:block"><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{rx.clientName}</p><p className="text-[11px] text-gray-400">{rx.clientPatientNo}</p></div>
            <div className="hidden truncate text-sm text-gray-600 dark:text-gray-300 sm:col-span-3 sm:block">{rx.diagnosis || '—'}</div>
            <div className="hidden text-xs text-gray-500 sm:col-span-1 sm:block">{rx.date}</div>
            <div className="hidden text-xs sm:col-span-1 sm:block">{rx.followUpDate ? <span className={rx.followUpDate >= today ? 'font-semibold text-amber-600' : 'text-gray-400'}>{rx.followUpDate}</span> : <span className="text-gray-300">—</span>}</div>
            <div className="col-span-2 flex flex-wrap justify-end gap-1 sm:col-span-2">
              <button onClick={() => setViewRx(rx)} title="View" className="rounded-lg p-1.5 text-gray-400 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"><Eye className="h-3.5 w-3.5" /></button>
              <button onClick={() => openEdit(rx)} title="Edit" className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => openDuplicate(rx)} title="Duplicate for repeat visit" className="rounded-lg p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"><Copy className="h-3.5 w-3.5" /></button>
              <button onClick={() => downloadPdf(rx)} title="Download PDF" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Download className="h-3.5 w-3.5" /></button>
              <button onClick={() => printPdf(rx)} title="Print" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Printer className="h-3.5 w-3.5" /></button>
              <button onClick={() => sendWhatsapp(rx)} title="Share on WhatsApp" className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600"><MessageCircle className="h-3.5 w-3.5" /></button>
              <button onClick={() => cancelRx(rx)} title="Cancel" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <PrescriptionFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditRx(null); setDuplicateFrom(null); }}
        onSaved={() => { setShowForm(false); setEditRx(null); setDuplicateFrom(null); loadData(); }}
        staff={staff} clients={clients} initialClientId={prefillClientId}
        editRx={editRx} duplicateFrom={duplicateFrom}
        templates={templates} suggestions={suggestions}
        onTemplateSaved={(tpl) => setTemplates(t => [...t, tpl])}
      />
      <PrescriptionViewModal rx={viewRx} isOpen={!!viewRx} onClose={() => setViewRx(null)} />
    </div>
  );
}
