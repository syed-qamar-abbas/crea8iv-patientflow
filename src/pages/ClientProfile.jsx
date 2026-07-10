import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, CreditCard, FileText, Image as ImageIcon, Loader2, Mail, MessageCircle, Phone, Save, Trash2, Upload, UserRound } from 'lucide-react';
import { fetchApi, API_URL } from '../config/api';
import { useClinic } from '../context/ClinicContext';

const FILE_BASE = API_URL.replace(/\/api\/v1\/?$/, '');
const fileUrl = (u) => (u && u.startsWith('http') ? u : FILE_BASE + u);

function PatientDocuments({ clientId }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => fetchApi(`/gallery/${clientId}`).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('type', 'document');
      fd.append('isPrivate', 'true');
      await fetchApi(`/gallery/${clientId}`, { method: 'POST', body: fd });
      load();
    } catch (e2) { setErr(e2.message || 'Upload failed'); } finally { setBusy(false); }
  };

  const del = async (item) => {
    if (!window.confirm('Delete this file?')) return;
    try { await fetchApi(`/gallery/${item.id}`, { method: 'DELETE' }); load(); }
    catch (e2) { setErr(e2.message); }
  };

  const isPdf = (u) => String(u || '').toLowerCase().endsWith('.pdf');

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-950 dark:text-white">Documents &amp; Files</h3>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
          <input type="file" accept=".pdf,image/*" className="hidden" onChange={onPick} disabled={busy} />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">Consent forms, lab reports, prescriptions, x-rays (PDF or image, max 15 MB).</p>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      {!items ? (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No documents uploaded yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
              <a href={fileUrl(item.imageUrl)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-800 hover:text-indigo-600 dark:text-gray-100">
                {isPdf(item.imageUrl) ? <FileText className="h-4 w-4 shrink-0 text-rose-500" /> : <ImageIcon className="h-4 w-4 shrink-0 text-indigo-500" />}
                <span className="truncate">{item.service || item.notes || (isPdf(item.imageUrl) ? 'Document.pdf' : 'Image')}</span>
              </a>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-gray-400">{String(item.createdAt || '').slice(0, 10)}</span>
                <button onClick={() => del(item)} className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ToothPicker from '../components/clinical/ToothPicker';

const money = (value) => `PKR ${Number(value || 0).toLocaleString()}`;

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-950 dark:text-white">{value || '—'}</p>
    </div>
  );
}

const TP_STATUS = {
  planned: { label: 'Planned', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300' },
  in_progress: { label: 'In progress', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-100 text-rose-700' },
};

function TreatmentPlan({ clientId, readOnly }) {
  const { term } = useClinic();
  const treatmentLabel = term('treatment', 'Treatment');
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ procedure: '', tooth: '', cost: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetchApi(`/clients/${clientId}/treatment-plan`).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const add = async () => {
    if (!form.procedure.trim()) return;
    setBusy(true); setErr('');
    try {
      await fetchApi(`/clients/${clientId}/treatment-plan`, { method: 'POST', body: JSON.stringify({ procedure: form.procedure, tooth: form.tooth, cost: Number(form.cost) || 0 }) });
      setForm({ procedure: '', tooth: '', cost: '' }); load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const setStatus = async (item, status) => { try { await fetchApi(`/treatment-plan/${item.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); load(); } catch (e) { setErr(e.message); } };
  const del = async (item) => { if (!window.confirm(`Remove this ${treatmentLabel.toLowerCase()}?`)) return; try { await fetchApi(`/treatment-plan/${item.id}`, { method: 'DELETE' }); load(); } catch (e) { setErr(e.message); } };

  const total = (items || []).filter((i) => i.status !== 'cancelled').reduce((s, i) => s + Number(i.cost || 0), 0);
  const fld = 'rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300';

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-950 dark:text-white">{treatmentLabel} Plan</h3>
        {total > 0 && <span className="text-xs font-bold text-gray-500">Plan total: {money(total)}</span>}
      </div>
      {readOnly && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Existing entries are preserved for reference only. This is not a complete or authoritative clinical record.</p>}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      {!items ? (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{it.procedure}{it.tooth ? <span className="text-gray-400 font-normal"> · tooth {it.tooth}</span> : null}</p>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{money(it.cost)}</span>
              {readOnly ? <span className={`rounded-full px-2 py-1 text-xs font-bold ${TP_STATUS[it.status]?.cls || TP_STATUS.planned.cls}`}>{TP_STATUS[it.status]?.label || it.status}</span> : (
                <>
                  <select value={it.status} onChange={(e) => setStatus(it, e.target.value)} className={`${fld} text-xs`}>
                    {Object.entries(TP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={() => del(it)} className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No {treatmentLabel.toLowerCase()}s planned yet.</p>}
        </div>
      )}

      {!readOnly && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
        <input className={`${fld} flex-1 min-w-[140px]`} placeholder={`${treatmentLabel} details`} value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} />
        <input className={`${fld} w-24`} placeholder="Tooth" value={form.tooth} onChange={(e) => setForm({ ...form, tooth: e.target.value })} />
        <input className={`${fld} w-28`} type="number" placeholder="Cost" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        <Button size="sm" onClick={add} disabled={busy || !form.procedure.trim()}>Add</Button>
      </div>}
    </div>
  );
}

const procedurePresets = {
  Implant: ['toothNumber', 'jaw', 'side', 'notes'],
  'Root Canal': ['toothNumber', 'canalType', 'notes'],
  Extraction: ['toothNumber', 'extractionType', 'notes'],
  Crown: ['toothNumber', 'crownMaterial', 'notes'],
  Filling: ['toothNumber', 'notes'],
};

const emptyProcedure = {
  procedureType: 'Implant',
  toothNumber: '',
  jaw: '',
  side: '',
  canalType: '',
  extractionType: '',
  crownMaterial: '',
  cost: '',
  notes: '',
  followUpDate: '',
  status: 'completed',
  performedAt: todayDate(),
};

const procStatusBadge = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  planned: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function DentalProcedureDetails({ clientId, appointments, readOnly }) {
  const { term } = useClinic();
  const treatmentLabel = term('treatment', 'Treatment');
  const doctorLabel = term('doctor', 'Doctor');
  const [items, setItems] = useState(null);
  const [canManageCost, setCanManageCost] = useState(false);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyProcedure);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetchApi(`/clients/${clientId}/treatment-details`).then(res => {
    setItems(res.items || []);
    setCanManageCost(!!res.canManageCost);
  }).catch(e => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);
  // Services power the treatment-type picker + auto-fill the cost.
  useEffect(() => { fetchApi('/services').then(r => setServices(Array.isArray(r) ? r : (r.services || r.data || []))).catch(() => {}); }, []);

  // Pick a service (or type a custom name); auto-fill cost from the service price.
  const chooseTreatmentType = (v) => setForm(cur => {
    const svc = services.find(s => (s.name || '').toLowerCase() === (v || '').toLowerCase());
    return { ...cur, procedureType: v, ...(svc && canManageCost ? { cost: svc.price } : {}) };
  });

  const visibleFields = procedurePresets[form.procedureType] || ['toothNumber', 'notes'];
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.procedureType.trim()) return setErr(`${treatmentLabel} type is required.`);
    if (visibleFields.includes('toothNumber') && !form.toothNumber.trim()) return setErr('Tooth number is required for this procedure.');
    setBusy(true); setErr('');
    try {
      await fetchApi(`/clients/${clientId}/treatment-details`, { method: 'POST', body: JSON.stringify(form) });
      setForm({ ...emptyProcedure, procedureType: form.procedureType, performedAt: todayDate() });
      load();
    } catch (e) {
      setErr(e.message || 'Procedure detail could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Archive ${item.procedureType}?`)) return;
    try {
      await fetchApi(`/treatment-details/${item.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-gray-950 dark:text-white">Dental Procedure Details</h3>
          <p className="mt-1 text-xs text-gray-400">Structured tooth, jaw, material, canal, extraction, and follow-up details.</p>
        </div>
        {!readOnly && <div className="flex flex-wrap gap-1">
          {Object.keys(procedurePresets).map(name => (
            <button key={name} onClick={() => setForm({ ...emptyProcedure, procedureType: name, performedAt: form.performedAt || todayDate() })} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${form.procedureType === name ? 'border-transparent bg-[var(--primary)] text-white' : 'border-gray-200 text-gray-500'}`}>
              {name}
            </button>
          ))}
        </div>}
      </div>
      {readOnly && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Procedure entry is disabled. Historical rows remain visible and must be verified against the clinic's approved clinical record.</p>}
      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{err}</p>}

      {!readOnly && <><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <input list="pf-service-list" value={form.procedureType} onChange={e => chooseTreatmentType(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder={`${treatmentLabel} type — pick a service or type custom`} />
        <datalist id="pf-service-list">
          {services.map(s => <option key={s.id} value={s.name} label={`PKR ${Number(s.price || 0).toLocaleString()}`} />)}
        </datalist>
        <input type="date" value={String(form.performedAt || '').slice(0, 10)} onChange={e => set('performedAt', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" title="Treatment date" />
        <select value={form.status} onChange={e => set('status', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" title="Status">
          <option value="completed">Completed</option>
          <option value="in_progress">In progress</option>
          <option value="planned">Planned</option>
        </select>
        <select value={form.appointmentId || ''} onChange={e => set('appointmentId', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" title="Related appointment">
          <option value="">No linked appointment</option>
          {appointments.map(appt => <option key={appt.id} value={appt.id}>{appt.date} - {appt.service?.name || appt.serviceName || treatmentLabel}</option>)}
        </select>
        <input type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" title="Follow-up date" />
      </div>

      {visibleFields.includes('toothNumber') && (
        <div className="mt-3"><ToothPicker value={form.toothNumber} onChange={v => set('toothNumber', v)} /></div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        {visibleFields.includes('toothNumber') && <input value={form.toothNumber} onChange={e => set('toothNumber', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Tooth number(s) — comma separated (or pick above)" />}
        {visibleFields.includes('jaw') && <select value={form.jaw} onChange={e => set('jaw', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"><option value="">Jaw</option><option>Upper</option><option>Lower</option></select>}
        {visibleFields.includes('side') && <select value={form.side} onChange={e => set('side', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"><option value="">Side</option><option>Left</option><option>Right</option></select>}
        {visibleFields.includes('canalType') && <input value={form.canalType} onChange={e => set('canalType', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Canal type" />}
        {visibleFields.includes('extractionType') && <input value={form.extractionType} onChange={e => set('extractionType', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Extraction type" />}
        {visibleFields.includes('crownMaterial') && <input value={form.crownMaterial} onChange={e => set('crownMaterial', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Crown material" />}
        {canManageCost && <input type="number" min="0" step="any" inputMode="decimal" value={form.cost} onChange={e => set('cost', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Cost (PKR)" title="Cost charged for this procedure" />}
        <input value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 md:col-span-2" placeholder="Clinical notes" />
      </div>

      <div className="mt-3 flex justify-end">
        <Button onClick={submit} disabled={busy}><Save className="h-4 w-4" /> Save Procedure</Button>
      </div>
      </>}

      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-white/10">
        {!items ? (
          <div className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No detailed procedures recorded yet.</p>
        ) : items.map(item => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-950 dark:text-white">
                <span>{item.procedureType}{item.toothNumber ? <span className="font-normal text-gray-400"> - tooth {item.toothNumber}</span> : null}</span>
                {item.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${procStatusBadge[item.status] || procStatusBadge.completed}`}>{String(item.status).replace('_', ' ')}</span>}
                {canManageCost && Number(item.cost) > 0 && <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">{money(item.cost)}</span>}
              </p>
              <p className="text-xs text-gray-500">{String(item.performedAt || '').slice(0, 10)} - {item.staffName || doctorLabel}{item.followUpDate ? ` - follow-up ${item.followUpDate}` : ''}</p>
            </div>
            {!readOnly && <button onClick={() => remove(item)} className="self-start rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 sm:self-center"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TreatmentTimeline({ clientId }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    fetchApi(`/clients/${clientId}/treatment-timeline`).then(setItems).catch(e => setErr(e.message));
  }, [clientId]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-[var(--primary)]" />
        <h3 className="text-sm font-black text-gray-950 dark:text-white">Treatment Timeline</h3>
      </div>
      <p className="mt-1 text-xs text-gray-400">Treatment date, procedure, tooth, clinician, invoice, notes, and follow-up history.</p>
      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}
      {!items ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No treatment timeline yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map(item => (
            <div key={item.id} className="relative rounded-lg border border-gray-100 p-3 dark:border-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-950 dark:text-white">{item.procedure}{item.toothNumber ? <span className="font-normal text-gray-400"> - tooth {item.toothNumber}</span> : null}</p>
                  <p className="text-xs text-gray-500">{item.date || 'No date'}{item.dentist ? ` - ${item.dentist}` : ''}</p>
                  {item.notes && <p className="mt-1 text-xs text-gray-500">{item.notes}</p>}
                </div>
                <div className="text-left text-xs sm:text-right">
                  {item.invoice && <p className="font-bold text-[var(--primary)]">{item.invoice}</p>}
                  {item.followUp && <p className="mt-1 text-amber-700">Follow-up {item.followUp}</p>}
                  {item.balanceDue !== undefined && <p className="mt-1 text-gray-500">Balance {money(item.balanceDue)}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientProfile() {
  const { term, features } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const patientsLabel = term('patients', 'Patients');
  const appointmentLabel = term('appointment', 'Appointment');
  const appointmentsLabel = term('appointments', 'Appointments');
  const staffLabel = term('staff', 'Staff');
  const clinicalReadOnly = !features.treatmentProcedureEntryEnabled;
  const visitLabel = term('visit', 'Visit');
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchApi(`/clients/${id}`),
      fetchApi(`/clients/${id}/appointments`).catch(() => []),
    ]).then(([clientData, appointmentData]) => {
      if (!alive) return;
      setClient(clientData);
      setAppointments(Array.isArray(appointmentData) ? appointmentData : []);
    }).catch((err) => setError(err.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  const totals = useMemo(() => ({
    visits: appointments.length,
    upcoming: appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.date >= new Date().toISOString().slice(0, 10)).length,
    completed: appointments.filter((a) => a.status === 'completed').length,
  }), [appointments]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  if (error || !client) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-semibold text-gray-500">{error || `${patientLabel} not found`}</p>
        <Button className="mt-4" onClick={() => navigate('/clients')}>Back to {patientsLabel}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back to {patientsLabel}
        </button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/whatsapp?client=${client.id}`)}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button size="sm" onClick={() => navigate('/appointments')}>
            <Calendar className="h-4 w-4" /> Book {appointmentLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white" style={{ background: client.avatarColor || '#0f766e' }}>
                {client.initials || client.name?.slice(0, 2)?.toUpperCase()}
              </div>
              <h2 className="mt-3 text-lg font-black text-gray-950 dark:text-white">{client.name}</h2>
              <p className="text-xs text-gray-400">{client.patientNo || `No ${patientLabel.toLowerCase()} number`}</p>
              <div className="mt-3 flex justify-center">{client.status && <Badge label={client.status} variant={client.status} />}</div>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <p className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Phone className="h-4 w-4 text-gray-400" /> {client.phone || 'No phone'}</p>
              <p className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Mail className="h-4 w-4 text-gray-400" /> {client.email || 'No email'}</p>
              <p className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><UserRound className="h-4 w-4 text-gray-400" /> {client.gender || 'Not specified'}</p>
              <p className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><CreditCard className="h-4 w-4 text-gray-400" /> Due {money(client.outstandingBalance)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Total Spent" value={money(client.totalSpent)} />
            <InfoCard label="Loyalty Tier" value={client.loyaltyTier} />
            <InfoCard label={`${visitLabel}s`} value={totals.visits} />
            <InfoCard label="Upcoming" value={totals.upcoming} />
          </div>
          {client.canViewCost && (
            <div className="mt-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Patient profit &amp; loss</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-[10px] font-semibold uppercase text-gray-400">Revenue</p><p className="mt-1 text-sm font-black text-emerald-600">{money(client.totalSpent)}</p></div>
                <div className="border-x border-gray-100 dark:border-white/10"><p className="text-[10px] font-semibold uppercase text-gray-400">Cost</p><p className="mt-1 text-sm font-black text-gray-700 dark:text-gray-200">{money(client.procedureCostTotal)}</p></div>
                <div><p className="text-[10px] font-semibold uppercase text-gray-400">Net Profit</p><p className={`mt-1 text-sm font-black ${Number(client.netProfit) >= 0 ? 'text-[var(--primary)]' : 'text-rose-600'}`}>{money(client.netProfit)}</p></div>
              </div>
            </div>
          )}
        </aside>

        <main className="space-y-5">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h3 className="text-sm font-black text-gray-950 dark:text-white">{appointmentLabel} History</h3>
            <div className="mt-4 space-y-2">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-950 dark:text-white">{appt.service?.name || appt.serviceName || appointmentLabel}</p>
                    <p className="text-xs text-gray-500">{appt.date} · {appt.startTime} · {appt.staff?.name || appt.staffName || staffLabel}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {appt.status && <Badge label={appt.status} variant={appt.status} />}
                    <span className="text-xs font-black text-gray-950 dark:text-white">{money(appt.price)}</span>
                  </div>
                </div>
              ))}
              {appointments.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No {appointmentsLabel.toLowerCase()} yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h3 className="text-sm font-black text-gray-950 dark:text-white">Operational Notes</h3>
            <p className="mt-2 text-sm text-gray-500">{client.notes || 'No operational notes recorded yet.'}</p>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Not an authoritative clinical note or medical record.</p>
          </div>

          <TreatmentPlan clientId={client.id} readOnly={clinicalReadOnly} />

          <DentalProcedureDetails clientId={client.id} appointments={appointments} readOnly={clinicalReadOnly} />

          <TreatmentTimeline clientId={client.id} />

          <PatientDocuments clientId={client.id} />
        </main>
      </div>
    </div>
  );
}
