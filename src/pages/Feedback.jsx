import { useEffect, useMemo, useState } from 'react';
import { Edit2, Loader2, MessageSquare, Plus, Star, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ProgressBar from '../components/ui/ProgressBar';
import StarRating from '../components/ui/StarRating';

const emptyForm = {
  clientId: '',
  appointmentId: '',
  staffId: '',
  staffRating: 5,
  serviceRating: 5,
  overallRating: 5,
  comment: '',
  wouldRecommend: true,
  isPublic: true,
};

const makeInitials = (name = '') => name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'PT';

function FeedbackModal({ isOpen, onClose, onSave, feedback, clients, staff, appointments, saving }) {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const staffLabel = term('staff', 'Staff');
  const appointmentLabel = term('appointment', 'Appointment');
  const serviceLabel = term('service', 'Service');
  const [form, setForm] = useState(emptyForm);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setForm(feedback ? {
      clientId: feedback.clientId || '',
      appointmentId: feedback.appointmentId || '',
      staffId: feedback.staffId || '',
      staffRating: Number(feedback.staffRating || 5),
      serviceRating: Number(feedback.serviceRating || 5),
      overallRating: Number(feedback.overallRating || 5),
      comment: feedback.comment || '',
      wouldRecommend: Boolean(Number(feedback.wouldRecommend ?? 1)),
      isPublic: Boolean(Number(feedback.isPublic ?? 1)),
    } : emptyForm);
    setValidationError('');
  }, [feedback, isOpen]);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.clientId) {
      setValidationError(`${patientLabel} is required.`);
      return;
    }
    setValidationError('');
    onSave({
      ...form,
      appointmentId: form.appointmentId || null,
      staffId: form.staffId || null,
      staffRating: Number(form.staffRating),
      serviceRating: Number(form.serviceRating),
      overallRating: Number(form.overallRating),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={feedback ? 'Edit Feedback' : 'Add Feedback'} size="lg">
      <div className="space-y-4">
        {validationError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {validationError}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {patientLabel}
            <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.clientId} onChange={e => set('clientId', e.target.value)}>
              <option value="">Select {patientLabel.toLowerCase()}</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.patientNo ? `${client.patientNo} · ` : ''}{client.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {staffLabel}
            <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.staffId} onChange={e => set('staffId', e.target.value)}>
              <option value="">Optional {staffLabel.toLowerCase()}</option>
              {staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
          {appointmentLabel}
          <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.appointmentId} onChange={e => set('appointmentId', e.target.value)}>
            <option value="">No {appointmentLabel.toLowerCase()} link</option>
            {appointments.map(appt => <option key={appt.id} value={appt.id}>{appt.date} · {appt.client?.name || appt.clientName || patientLabel} · {appt.service?.name || appt.serviceName || serviceLabel}</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['staffRating', `${staffLabel} Rating`],
            ['serviceRating', `${serviceLabel} Rating`],
            ['overallRating', 'Overall Rating'],
          ].map(([key, label]) => (
            <label key={key} className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {label}
              <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form[key]} onChange={e => set(key, e.target.value)}>
                {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} Stars</option>)}
              </select>
            </label>
          ))}
        </div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
          Comment
          <textarea rows={4} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.comment} onChange={e => set('comment', e.target.value)} placeholder={`${patientLabel} feedback...`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-xs font-bold dark:border-white/10">
            <input type="checkbox" checked={form.wouldRecommend} onChange={e => set('wouldRecommend', e.target.checked)} />
            {patientLabel} would recommend
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-xs font-bold dark:border-white/10">
            <input type="checkbox" checked={form.isPublic} onChange={e => set('isPublic', e.target.checked)} />
            Show on public website
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{feedback ? 'Save Feedback' : 'Create Feedback'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Feedback() {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const staffLabel = term('staff', 'Staff');
  const serviceLabel = term('service', 'Service');
  const [feedback, setFeedback] = useState([]);
  const [summary, setSummary] = useState({ total: 0, avgOverall: 0, avgStaff: 0, avgService: 0, recommendRate: 0 });
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffFilter, setStaffFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editFeedback, setEditFeedback] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [fb, sum, clientRows, staffRows, apptRows] = await Promise.all([
        fetchApi('/feedback'),
        fetchApi('/feedback/summary'),
        fetchApi('/clients'),
        fetchApi('/staff'),
        fetchApi('/appointments'),
      ]);
      setFeedback(fb);
      setSummary(sum);
      setClients(Array.isArray(clientRows) ? clientRows : (clientRows.clients || []));
      setStaff(staffRows);
      setAppointments(apptRows);
    } catch (err) {
      setError(err.message || 'Feedback data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const staffPerformance = useMemo(() => staff.map(member => {
    const reviews = feedback.filter(row => row.staffId === member.id);
    const avgRating = reviews.length ? reviews.reduce((sum, row) => sum + Number(row.overallRating || 0), 0) / reviews.length : Number(member.rating || 0);
    return { ...member, avgRating: Number(avgRating.toFixed(1)), reviewCount: reviews.length };
  }).sort((a, b) => b.avgRating - a.avgRating), [staff, feedback]);

  const filtered = feedback.filter(row => {
    if (staffFilter !== 'all' && row.staffId !== staffFilter) return false;
    if (ratingFilter > 0 && Number(row.overallRating || 0) < ratingFilter) return false;
    return true;
  });

  const saveFeedback = async (payload) => {
    setSaving(true);
    setError('');
    try {
      if (editFeedback) {
        await fetchApi(`/feedback/${editFeedback.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await fetchApi('/feedback', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      setEditFeedback(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Feedback could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const deleteFeedback = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await fetchApi(`/feedback/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Feedback could not be deleted.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{patientLabel} Feedback & {staffLabel} Performance</h1>
          <p className="mt-0.5 text-sm text-gray-500">Live CRUD for {patientLabel.toLowerCase()} reviews with automatic {staffLabel.toLowerCase()} rating updates.</p>
        </div>
        <Button onClick={() => { setEditFeedback(null); setShowForm(true); }}><Plus className="h-4 w-4" /> Add Feedback</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Overall Rating', value: `${Number(summary.avgOverall || 0).toFixed(1)}★`, color: 'text-amber-500' },
          { label: 'Total Reviews', value: summary.total || 0, color: 'text-[var(--primary)]' },
          { label: 'Recommend Rate', value: `${summary.recommendRate || 0}%`, color: 'text-green-600' },
          { label: `Avg ${staffLabel} Rating`, value: Number(summary.avgStaff || 0).toFixed(1), color: 'text-purple-600' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <select className="rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
              <option value="all">All {staffLabel}</option>
              {staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <select className="rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900" value={ratingFilter} onChange={e => setRatingFilter(Number(e.target.value))}>
              <option value={0}>All Ratings</option>
              {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value}+ Stars</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading feedback...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white py-16 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No feedback found</p>
              <p className="mt-1 text-xs text-gray-400">Create real feedback entries. Dummy reviews have been removed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(row => {
                const clientName = row.client?.name || `Unknown ${patientLabel.toLowerCase()}`;
                const staffName = row.appointment?.staff?.name || staff.find(s => s.id === row.staffId)?.name || `No ${staffLabel.toLowerCase()} linked`;
                return (
                  <div key={row.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: row.client?.avatarColor || '#6366f1' }}>
                          {row.client?.initials || makeInitials(clientName)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{clientName}</p>
                          <p className="text-xs text-gray-500">{row.appointment?.service?.name || 'General feedback'} · {String(row.createdAt || '').slice(0, 10)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge label={row.isPublic ? 'public' : 'private'} variant={row.isPublic ? 'active' : 'inactive'} />
                        <button onClick={() => { setEditFeedback(row); setShowForm(true); }} className="rounded-lg p-2 text-gray-400 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteTarget(row)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-4 rounded-xl bg-gray-50 p-3 dark:bg-white/5">
                      {[
                        [staffLabel, row.staffRating],
                        [serviceLabel, row.serviceRating],
                        ['Overall', row.overallRating],
                      ].map(([label, rating]) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="w-14 text-xs font-medium text-gray-500">{label}</span>
                          <StarRating rating={Number(rating || 0)} size="sm" />
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{rating}/5</span>
                        </div>
                      ))}
                    </div>
                    {row.comment && <p className="text-sm italic leading-relaxed text-gray-700 dark:text-gray-200">"{row.comment}"</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3 text-xs text-gray-500 dark:border-white/10">
                      <span>{staffName}</span>
                      <span className={`flex items-center gap-1 ${row.wouldRecommend ? 'text-green-600' : 'text-red-500'}`}>
                        {row.wouldRecommend ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        {row.wouldRecommend ? 'Would recommend' : 'Would not recommend'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">{staffLabel} Performance</h3>
            {staffPerformance.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No {staffLabel.toLowerCase()} records found.</p>
            ) : (
              <div className="space-y-3">
                {staffPerformance.map(member => (
                  <button key={member.id} onClick={() => setStaffFilter(staffFilter === member.id ? 'all' : member.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${staffFilter === member.id ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: member.avatarColor || '#6366f1' }}>{member.avatar || makeInitials(member.name)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">{member.name}</p>
                        <p className="text-[10px] text-gray-500">{member.role} · {member.reviewCount} reviews</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{member.avgRating}</span>
                      </div>
                    </div>
                    <ProgressBar value={(member.avgRating / 5) * 100} color={member.avgRating >= 4.5 ? '#22c55e' : '#f59e0b'} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <FeedbackModal isOpen={showForm} onClose={() => { setShowForm(false); setEditFeedback(null); }} onSave={saveFeedback} feedback={editFeedback} clients={clients} staff={staff} appointments={appointments} saving={saving} />
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Feedback" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
            <p className="text-sm font-bold">Delete this feedback?</p>
            <p className="mt-1 text-xs leading-5">This review will be removed from feedback reporting and public display.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={deleteFeedback}><Trash2 className="h-4 w-4" /> Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
