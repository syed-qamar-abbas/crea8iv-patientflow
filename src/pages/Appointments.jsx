import { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, List, Plus, X, ChevronRight, Pencil, Trash2, Save, Loader2, CalendarClock, QrCode } from 'lucide-react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { fetchApi, peekApiCacheByPrefix } from '../config/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useClinic } from '../context/ClinicContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import PatientSearchSelect from '../components/ui/PatientSearchSelect';
import QRCheckin from '../components/ui/QRCheckin';
import WhatsAppActionButton, { buildClientMessage } from '../components/outreach/WhatsAppActionButton';
import { MANUAL_WHATSAPP_TEMPLATES, openWhatsAppMessage } from '../utils/whatsapp';

const localizer = momentLocalizer(moment);

const money = (value) => `PKR ${Number(value || 0).toLocaleString()}`;
const getTreatmentFee = (appt) => Number(appt.price ?? 0);

const apptClientName = (a) => a.clientName || a.client?.name || '—';
const apptStaffName = (a) => a.staffName || a.staff?.name || '—';
const apptServiceName = (a) => a.service?.name || a.serviceName || (typeof a.service === 'string' ? a.service : '') || a.otherTreatment || '—';

const computeEndTime = (start, durationMins) => {
  if (!start || !durationMins) return start;
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + Number(durationMins);
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
};

function AppointmentDetail({ appt, onClose, onEdit, onDelete, onReschedule, onQr, term }) {
  if (!appt) return null;
  const name = apptClientName(appt);
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-900 shadow-2xl z-40 flex flex-col border-l border-gray-100 dark:border-white/10">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{term('appointment', 'Appointment')} Details</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold bg-teal-700">
            {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
            {appt.status && <Badge label={appt.status} variant={appt.status} />}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Type', value: (appt.eventType || 'appointment').replaceAll('_', ' ') },
            { label: 'Date', value: appt.date },
            { label: 'Time', value: `${appt.startTime} – ${appt.endTime || ''}` },
            { label: 'Duration', value: appt.duration ? `${appt.duration} min` : '—' },
            { label: 'Room', value: appt.room || '—' },
            { label: `${term('service', 'Service')} Fee`, value: money(getTreatmentFee(appt)) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-1 capitalize">{value}</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{term('service', 'Service')}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{apptServiceName(appt)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{term('doctor', 'Doctor')} / {term('staff', 'Staff')}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{apptStaffName(appt)}</p>
        </div>
        {appt.notes && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-600 mb-1">Notes</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">{appt.notes}</p>
          </div>
        )}
      </div>
      <div className="p-6 border-t border-gray-100 dark:border-white/10 space-y-2">
        <Button variant="secondary" size="sm" className="w-full justify-center" onClick={() => onQr(appt)} disabled={appt.checkedIn || ['cancelled', 'completed', 'no-show'].includes(appt.status)}>
          <QrCode className="w-4 h-4" /> Secure QR check-in
        </Button>
        <Button variant="secondary" size="sm" className="w-full justify-center" onClick={() => onReschedule(appt)}>
          <CalendarClock className="w-4 h-4" /> Reschedule
        </Button>
        <div className="flex gap-2">
          <WhatsAppActionButton client={appt.client || { id: appt.clientId, name: appt.clientName, phone: appt.clientPhone }} appointment={appt} template={MANUAL_WHATSAPP_TEMPLATES.find(t => t.key === 'appointment_reminder')} />
          <Button variant="primary" size="sm" className="flex-1 justify-center" onClick={() => onEdit(appt)}>
            <Pencil className="w-4 h-4" /> Edit
          </Button>
          <Button variant="danger" size="sm" className="flex-1 justify-center" onClick={() => onDelete(appt)}>
            <Trash2 className="w-4 h-4" /> Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

const emptyForm = {
  clientId: '', staffId: '', serviceId: '', otherTreatment: '',
  price: '',
  eventType: 'appointment', date: new Date().toISOString().slice(0, 10),
  startTime: '10:00', duration: 30, room: '', notes: '', status: 'pending',
};

function AppointmentFormModal({ isOpen, onClose, onSave, target, clients, staff, services, saving, term, template }) {
  const isEdit = !!target;
  const [form, setForm] = useState(emptyForm);
  const scheduling = template.config.scheduling || {};
  const eventTypes = scheduling.eventTypes || [{ key: 'appointment', label: term('appointment', 'Appointment') }];

  useEffect(() => {
    if (target) {
      setForm({
        clientId: target.clientId || target.client?.id || '',
        staffId: target.staffId || target.staff?.id || '',
        serviceId: target.serviceId || target.service?.id || '',
        otherTreatment: target.otherTreatment || '',
        price: target.price ?? '',
        eventType: target.eventType || scheduling.defaultEventType || eventTypes[0]?.key || 'appointment',
        date: target.date ? String(target.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        startTime: target.startTime || '10:00',
        duration: target.duration || 30,
        room: target.room || '',
        notes: target.notes || '',
        status: target.status || 'pending',
      });
    } else {
      setForm({ ...emptyForm, eventType: scheduling.defaultEventType || eventTypes[0]?.key || 'appointment' });
    }
  }, [target, isOpen, template.templateKey]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const showOther = form.serviceId === 'other';
  const selectedService = services.find(s => s.id === form.serviceId);

  const selectService = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    setForm(curr => ({
      ...curr,
      serviceId,
      price: service ? String(service.price) : curr.price,
      duration: service?.duration || curr.duration,
    }));
  };

  const submit = () => {
    if (!form.clientId || !form.staffId || !form.date || !form.startTime) {
      alert(`${term('patient', 'Patient')}, ${term('staff', 'staff').toLowerCase()}, date and time are required.`);
      return;
    }
    const endTime = computeEndTime(form.startTime, form.duration);
    const payload = {
      clientId: form.clientId,
      staffId: form.staffId,
      serviceId: form.serviceId && form.serviceId !== 'other' ? form.serviceId : null,
      otherTreatment: form.serviceId === 'other' ? form.otherTreatment : null,
      date: form.date,
      startTime: form.startTime,
      endTime,
      duration: Number(form.duration),
      room: form.room,
      notes: form.notes,
      status: form.status,
      price: Number(form.price) || 0,
      eventType: form.eventType,
    };
    onSave(payload);
  };

  const inputCls = "w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${term('appointment', 'Appointment')}` : `New ${term('appointment', 'Appointment')}`} size="md">
      <div className="space-y-4">
        {eventTypes.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{term('appointment', 'Appointment')} Type *</label>
            <select className={inputCls} value={form.eventType} onChange={e => set('eventType', e.target.value)}>
              {eventTypes.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{term('patient', 'Patient')} *</label>
          <PatientSearchSelect
            value={form.clientId}
            onChange={(id) => set('clientId', id)}
            initialLabel={target?.clientName || target?.client?.name || ''}
            fallbackClients={clients}
            inputClassName={inputCls}
          />
          <p className="mt-1 text-[11px] text-gray-400">Type a name, phone number, or {term('patient', 'patient').toLowerCase()} #.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{term('service', 'Service')} *</label>
          <select className={inputCls} value={form.serviceId} onChange={e => selectService(e.target.value)}>
            <option value="">Select {term('service', 'service').toLowerCase()}...</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name} — PKR {Number(s.price).toLocaleString()}</option>)}
            <option value="other">Other {term('treatment', 'treatment').toLowerCase()}</option>
          </select>
        </div>
        {showOther && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Other {term('treatment', 'Treatment')} Name *</label>
            <input value={form.otherTreatment} onChange={e => set('otherTreatment', e.target.value)} placeholder={`Write ${term('treatment', 'treatment').toLowerCase()} name...`} className={inputCls} />
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{term('service', 'Service')} Fee *</label>
          <input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} className={inputCls} />
        </div>
        {(selectedService || showOther) && (
          <div className="rounded-lg border border-teal-100 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 px-3 py-2 text-xs text-teal-800 dark:text-teal-200">
            This is the final fee recorded for the appointment and used in reports.
          </div>
        )}
        <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{term('doctor', 'Doctor')} / {term('staff', 'Staff')} *</label>
          <select className={inputCls} value={form.staffId} onChange={e => set('staffId', e.target.value)}>
            <option value="">Select staff...</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Time</label>
            <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Duration (min)</label>
            <input type="number" value={form.duration} onChange={e => set('duration', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Room</label>
            <input value={form.room} onChange={e => set('room', e.target.value)} placeholder="e.g. Operatory 1" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Add any notes..." className={`${inputCls} resize-none`} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" className="flex-1 justify-center" onClick={submit} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : `Book ${term('appointment', 'Appointment')}`}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, name, deleting, term }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cancel ${term('appointment', 'Appointment')}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Cancel {term('appointment', 'appointment').toLowerCase()} for <span className="font-semibold">{name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Keep</Button>
          <Button variant="danger" onClick={onConfirm} disabled={deleting}>
            <Trash2 className="w-4 h-4" /> {deleting ? 'Cancelling...' : `Cancel ${term('appointment', 'Appointment')}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RescheduleModal({ appt, onClose, onDone, term }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { clinicInfo } = useClinic();

  useEffect(() => {
    if (appt) {
      setDate(appt.date ? String(appt.date).slice(0, 10) : new Date().toISOString().slice(0, 10));
      setTime(appt.startTime || '10:00');
      setNotify(true); setErr('');
    }
  }, [appt]);

  if (!appt) return null;
  const name = apptClientName(appt);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await fetchApi(`/appointments/${appt.id}/reschedule`, { method: 'PUT', body: JSON.stringify({ date, startTime: time }) });
      const clientId = appt.clientId || appt.client?.id;
      const client = appt.client || { id: clientId, name: appt.clientName, phone: appt.clientPhone };
      if (notify && clientId) {
        const template = MANUAL_WHATSAPP_TEMPLATES.find(t => t.key === 'appointment_reminder');
        const message = buildClientMessage({ clinicName: clinicInfo.name, client, appointment: { ...appt, date, startTime: time }, template });
        if (openWhatsAppMessage(client.phone, message)) {
          await fetchApi('/manual-outreach/logs', {
            method: 'POST',
            body: JSON.stringify({ clientId, appointmentId: appt.id, purpose: 'appointment_reminder', message, status: 'opened' }),
          }).catch(() => null);
        }
      }
      onDone();
    } catch (e) {
      setErr(e.message || 'Could not reschedule.');
    } finally { setBusy(false); }
  };

  const inputCls = "w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <Modal isOpen={!!appt} onClose={onClose} title={`Reschedule ${term('appointment', 'Appointment')}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Move <span className="font-semibold text-gray-800 dark:text-gray-100">{name}</span>'s {term('appointment', 'appointment').toLowerCase()} to a new date/time.</p>
        {err && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New date</label><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New time</label><input type="time" className={inputCls} value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
          Open WhatsApp to notify the {term('patient', 'patient').toLowerCase()}
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !date || !time}>{busy ? 'Rescheduling…' : 'Reschedule'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Appointments() {
  const { term, industryTemplate } = useClinic();
  const [appointments, setAppointments] = useState(() => {
    const c = peekApiCacheByPrefix('/appointments');
    return Array.isArray(c) ? c : (c?.appointments ?? []);
  });
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('date_desc'); // default: most recent date first
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [qrTarget, setQrTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAppointments = async () => {
    try {
      const data = await fetchApi('/appointments');
      setAppointments(Array.isArray(data) ? data : (data.appointments ?? data.data ?? []));
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    }
  };

  const loadAll = async () => {
    try {
      const [appts, c, s, srv] = await Promise.all([
        fetchApi('/appointments').catch(() => []),
        fetchApi('/clients').catch(() => ({ clients: [] })),
        fetchApi('/staff').catch(() => []),
        fetchApi('/services').catch(() => []),
      ]);
      setAppointments(Array.isArray(appts) ? appts : (appts.appointments ?? appts.data ?? []));
      setClients(Array.isArray(c) ? c : (c.clients ?? c.data ?? []));
      setStaff(Array.isArray(s) ? s : (s.staff ?? s.data ?? []));
      setServices(Array.isArray(srv) ? srv : (srv.services ?? srv.data ?? []));
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editTarget) {
        await fetchApi(`/appointments/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await fetchApi('/appointments', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowFormModal(false);
      setEditTarget(null);
      setSelectedAppt(null);
      await loadAppointments();
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
      await fetchApi(`/appointments/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setSelectedAppt(null);
      await loadAppointments();
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleManualCheckin = async (appointment) => {
    await fetchApi(`/appointments/${appointment.id}/checkin`, { method: 'PUT' });
    setQrTarget(null);
    await loadAppointments();
  };

  const filtered = useMemo(() => {
    const byDate = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || '');
    const name = (a) => (a.clientName || a.client?.name || '').toLowerCase();
    const sorters = {
      date_desc: (a, b) => byDate(b, a),
      date_asc: byDate,
      patient_asc: (a, b) => name(a).localeCompare(name(b)) || byDate(b, a),
      doctor_asc: (a, b) => (a.staffName || '').localeCompare(b.staffName || '') || byDate(b, a),
      amount_desc: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
    };
    return appointments.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    }).sort(sorters[sort] || sorters.date_desc);
  }, [appointments, statusFilter, sort]);

  const calendarEvents = useMemo(() => {
    return appointments.map(a => ({
      id: a.id,
      title: `${apptClientName(a)} — ${apptServiceName(a)}`,
      start: new Date(`${a.date}T${a.startTime}`),
      end: new Date(`${a.date}T${a.endTime || a.startTime}`),
      resource: a,
    }));
  }, [appointments]);

  const eventStyleGetter = () => ({
    style: {
      backgroundColor: '#0f766e',
      borderRadius: '6px',
      border: 'none',
      color: 'white',
      fontSize: '11px',
    },
  });

  const columns = [
    { key: 'startTime', label: 'Time', render: (v, r) => <span className="font-mono text-xs font-medium">{r.date} {v}</span> },
    { key: 'client', label: term('patient', 'Patient'), render: (_, r) => <span className="font-medium">{apptClientName(r)}</span> },
    { key: 'service', label: term('service', 'Service'), render: (_, r) => apptServiceName(r) },
    { key: 'staff', label: term('staff', 'Staff'), render: (_, r) => apptStaffName(r) },
    { key: 'room', label: 'Room' },
    { key: 'status', label: 'Status', render: (v) => v ? <Badge label={v} variant={v} /> : null },
    { key: 'price', label: 'Treatment Fee', render: (_, r) => <span className="font-bold text-teal-700">{money(getTreatmentFee(r))}</span> },
    {
      key: 'id', label: 'Actions', render: (_, r) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setEditTarget(r); setShowFormModal(true); }}
            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSelectedAppt(r); }}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1 px-2">
            View <ChevronRight className="w-3 h-3" />
          </button>
          <WhatsAppActionButton
            client={r.client || { id: r.clientId, name: r.clientName, phone: r.clientPhone }}
            appointment={r}
            template={MANUAL_WHATSAPP_TEMPLATES.find(t => t.key === 'appointment_reminder')}
            size="icon"
          />
        </div>
      ),
    },
  ];

  if (loading && appointments.length === 0) {
    return <div className="space-y-4"><TableSkeleton rows={8} cols={6} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-0.5">
            <button onClick={() => setView('calendar')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'calendar' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>
              <CalendarIcon className="w-3.5 h-3.5" /> Calendar
            </button>
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'list' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-white/5">
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} title={`Sort ${term('appointments', 'appointments').toLowerCase()}`}
            className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-white/5">
            <option value="date_desc">Date — newest first</option>
            <option value="date_asc">Date — oldest first</option>
            <option value="patient_asc">{term('patient', 'Patient')} — A to Z</option>
            <option value="doctor_asc">{term('doctor', 'Doctor')} — A to Z</option>
            <option value="amount_desc">Fee — high to low</option>
          </select>
        </div>
        <Button onClick={() => { setEditTarget(null); setShowFormModal(true); }} size="sm">
          <Plus className="w-4 h-4" /> New {term('appointment', 'Appointment')}
        </Button>
      </div>

      {view === 'calendar' ? (
        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-gray-100 dark:border-white/10 p-4" style={{ height: 620 }}>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            defaultView="week"
            views={['month', 'week', 'day']}
            step={30}
            timeslots={2}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(e) => setSelectedAppt(e.resource)}
            style={{ height: '100%' }}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-gray-100 dark:border-white/10">
          <div className="px-5 py-3.5 border-b border-gray-50 dark:border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">All {term('appointments', 'Appointments')}</span>
            <span className="text-xs text-gray-400">{filtered.length} records</span>
          </div>
          <Table columns={columns} data={filtered} onRowClick={(r) => setSelectedAppt(r)} />
        </div>
      )}

      {selectedAppt && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setSelectedAppt(null)} />
          <AppointmentDetail
            appt={selectedAppt}
            onClose={() => setSelectedAppt(null)}
            onEdit={(a) => { setEditTarget(a); setShowFormModal(true); }}
            onDelete={(a) => setDeleteTarget(a)}
            onReschedule={(a) => { setRescheduleTarget(a); setSelectedAppt(null); }}
            onQr={(a) => { setQrTarget(a); setSelectedAppt(null); }}
            term={term}
          />
        </>
      )}

      <QRCheckin
        appointment={qrTarget}
        isOpen={!!qrTarget}
        onClose={() => setQrTarget(null)}
        onCheckin={handleManualCheckin}
      />

      <RescheduleModal
        appt={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onDone={() => { setRescheduleTarget(null); loadAppointments(); }}
        term={term}
      />

      <AppointmentFormModal
        isOpen={showFormModal}
        onClose={() => { setShowFormModal(false); setEditTarget(null); }}
        onSave={handleSave}
        target={editTarget}
        clients={clients}
        staff={staff}
        services={services}
        saving={saving}
        term={term}
        template={industryTemplate}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget ? apptClientName(deleteTarget) : ''}
        deleting={deleting}
        term={term}
      />
    </div>
  );
}
