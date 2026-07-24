import { useState, useMemo, useEffect } from 'react';
import { Star, Clock, Plus, Phone, Mail, Send, WalletCards, KeyRound, Pencil, Trash2, Save, Loader2 } from 'lucide-react';
import { fetchApi, peekApiCacheByPrefix } from '../config/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useClinic } from '../context/ClinicContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const roleColors = {
  Dentist: '#3b82f6',
  'Lead Dental Surgeon': '#0f766e',
  'Cosmetic Dentist': '#2563eb',
  Endodontist: '#7c3aed',
  'Dental Assistant': '#14b8a6',
  Receptionist: '#64748b',
  Manager: '#6366f1',
};

const money = (value = 0) => `PKR ${Number(value || 0).toLocaleString()}`;
const makeInitials = (name = '') => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'ST';

const buildCredentialMessage = (staff, clinicInfo) => {
  const loginUrl = `${window.location.origin}/login`;
  const password = staff.tempPassword || 'ChangeMe@123';
  return `Welcome to ${clinicInfo.name}, ${staff.name}. Your ${staff.portalRole} portal is ready.\nLogin: ${loginUrl}\nEmail: ${staff.loginEmail}\nTemporary password: ${password}\nPlease change your password after first login.`;
};

const parseCommissionRates = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
};

function StaffDetailModal({ staff, onClose }) {
  const { term } = useClinic();
  const staffLabel = term('staff', 'Staff');
  const appointmentsLabel = term('appointments', 'appointments');
  const patientLabel = term('patient', 'patient');

  // Live performance stats (appointment counts + revenue) come from a dedicated
  // endpoint — the /staff list doesn't carry them, so fetch on open.
  const [perf, setPerf] = useState(null);
  useEffect(() => {
    if (!staff?.id) { setPerf(null); return; }
    let alive = true;
    fetchApi(`/staff/${staff.id}/performance`)
      .then((d) => { if (alive) setPerf(d); })
      .catch(() => { if (alive) setPerf(null); });
    return () => { alive = false; };
  }, [staff?.id]);

  if (!staff) return null;
  const commissionRates = parseCommissionRates(staff.treatmentCommissionRates);
  const monthAppointments = perf?.monthAppointments ?? staff.appointmentsThisMonth ?? 0;
  const allAppointments = perf?.allAppointments ?? staff.appointmentsHandled ?? 0;
  const staffRevenue = perf?.revenue ?? staff.revenue ?? 0;

  return (
    <Modal isOpen={!!staff} onClose={onClose} title={`${staffLabel} Profile`} size="lg">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0"
            style={{ background: staff.avatarColor || '#6366f1' }}>
            {staff.avatar || makeInitials(staff.name)}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{staff.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{staff.role}</p>
                {staff.qualifications && <p className="text-xs text-gray-400 mt-0.5">{staff.qualifications}</p>}
              </div>
              {staff.status && <Badge label={staff.status} variant={staff.status} />}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(staff.rating || 0) ? 'fill-current' : 'text-gray-200'}`} />
                ))}
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 ml-1">{staff.rating || 0}</span>
              </div>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{staff.experience || 'New'} experience</span>
            </div>
          </div>
        </div>

        {staff.bio && (
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{staff.bio}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</h4>
            <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
              <Phone className="w-3.5 h-3.5 text-gray-400" /> {staff.phone}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
              <Mail className="w-3.5 h-3.5 text-gray-400" /> {staff.email}
            </div>
          </div>
          {staff.workingHours && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Schedule</h4>
              <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                <Clock className="w-3.5 h-3.5 text-gray-400" /> {staff.workingHours}
              </div>
              <div className="flex gap-1 flex-wrap">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <span key={d}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${(staff.workingDays || []).includes(d) ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <WalletCards className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">Financial Profile</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-emerald-700/70">Pay type</p>
                <p className="font-bold text-emerald-950 dark:text-emerald-100 capitalize">{staff.compensationType || 'commission'}</p>
              </div>
              <div>
                <p className="text-emerald-700/70">Base salary</p>
                <p className="font-bold text-emerald-950 dark:text-emerald-100">{money(staff.fixedSalary)}</p>
              </div>
              <div>
                <p className="text-emerald-700/70">Default commission</p>
                <p className="font-bold text-emerald-950 dark:text-emerald-100">{staff.commissionRate || 0}%</p>
              </div>
              <div>
                <p className="text-emerald-700/70">Month estimate</p>
                <p className="font-bold text-emerald-950 dark:text-emerald-100">{money((staff.fixedSalary || 0) + (staffRevenue * (staff.commissionRate || 0)) / 100)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(commissionRates).map(([name, rate]) => (
                <span key={name} className="px-2 py-1 rounded-md bg-white/80 dark:bg-white/10 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200 capitalize">
                  {name}: {rate}%
                </span>
              ))}
            </div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Portal Access</h4>
            </div>
            <p className="text-xs text-indigo-950 dark:text-indigo-100 font-semibold">{staff.loginEmail || staff.email}</p>
            <p className="text-xs text-indigo-700 mt-1 capitalize">Role: {staff.portalRole || staff.role}</p>
            <p className="text-xs text-indigo-700 mt-1 capitalize">Invite: {staff.inviteStatus || 'ready'}</p>
            {staff.lastInviteSent && <p className="text-[10px] text-indigo-500 mt-1">Last sent {String(staff.lastInviteSent).slice(0, 10)}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'This Month', value: monthAppointments, sub: appointmentsLabel.toLowerCase(), color: 'text-indigo-600' },
            { label: 'All Time', value: allAppointments, sub: 'total handled', color: 'text-gray-900 dark:text-white' },
            { label: 'Revenue', value: `PKR ${(staffRevenue / 1000000).toFixed(1)}M`, sub: 'generated', color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          {staffLabel} performance is calculated from real {appointmentsLabel.toLowerCase()}, revenue and {patientLabel.toLowerCase()} feedback. Historical charts will appear once monthly analytics are recorded.
        </div>
      </div>
    </Modal>
  );
}

const emptyStaffForm = {
  name: '', role: 'Dentist', designation: '', specialty: 'dental',
  phone: '', email: '', experience: '', qualifications: '',
  compensationType: 'commission', fixedSalary: 0, commissionRate: 25,
  consultationRate: 10, procedureRate: 25, packageRate: 15,
  portalRole: 'doctor', status: 'active',
  sendEmail: true, sendWhatsapp: true,
};

function StaffFormModal({ isOpen, onClose, onSave, target, saving }) {
  const { term } = useClinic();
  const doctorLabel = term('doctor', 'Doctor');
  const staffLabel = term('staff', 'Staff');
  const treatmentLabel = term('treatment', 'Treatment');
  const isEdit = !!target;
  const [form, setForm] = useState(emptyStaffForm);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (target) {
      const rates = parseCommissionRates(target.treatmentCommissionRates);
      setForm({
        name: target.name || '',
        role: target.role || 'Dentist',
        designation: target.designation || '',
        specialty: target.specialty || 'dental',
        phone: target.phone || '',
        email: target.email || '',
        experience: target.experience || '',
        qualifications: target.qualifications || '',
        compensationType: target.compensationType || 'commission',
        fixedSalary: target.fixedSalary ?? 0,
        commissionRate: target.commissionRate ?? 0,
        consultationRate: rates.consultation ?? 10,
        procedureRate: rates.procedure ?? 25,
        packageRate: rates.package ?? 15,
        portalRole: target.portalRole || 'doctor',
        status: target.status || 'active',
        sendEmail: false,
        sendWhatsapp: false,
      });
    } else {
      setForm(emptyStaffForm);
    }
    setValidationError('');
  }, [target, isOpen]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      setValidationError('Name and email are required.');
      return;
    }
    setValidationError('');
    const payload = {
      name: form.name.trim(),
      role: form.role,
      designation: form.designation || form.role,
      specialty: form.specialty,
      phone: form.phone,
      email: form.email,
      loginEmail: form.email,
      experience: form.experience || 'New',
      qualifications: form.qualifications,
      compensationType: form.compensationType,
      fixedSalary: Number(form.fixedSalary) || 0,
      commissionRate: Number(form.commissionRate) || 0,
      treatmentCommissionRates: {
        consultation: Number(form.consultationRate) || 0,
        procedure: Number(form.procedureRate) || 0,
        package: Number(form.packageRate) || 0,
      },
      portalRole: form.portalRole,
      status: form.status,
      avatarColor: roleColors[form.role] || '#6366f1',
      sendCredentials: !isEdit && (form.sendEmail || form.sendWhatsapp),
    };
    onSave(payload, { sendEmail: form.sendEmail, sendWhatsapp: form.sendWhatsapp });
  };

  const inputCls = "w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit ${staffLabel} Profile` : `Create ${staffLabel} Profile`} size="xl">
      <div className="space-y-4">
        {validationError && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {validationError}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Full Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={`${doctorLabel} name`} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls}>
            <option value="Dentist">{doctorLabel}</option>
            <option value="Dental Assistant">{staffLabel}</option>
            <option value="Receptionist">Receptionist</option>
            <option value="Manager">Manager</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Designation</label>
          <input value={form.designation} onChange={e => set('designation', e.target.value)} placeholder={`Lead ${doctorLabel}, specialist...`} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92 300 0000000" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Email *</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@clinic.pk" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Experience</label>
            <input value={form.experience} onChange={e => set('experience', e.target.value)} placeholder="e.g. 5 years" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="active">Active</option>
              <option value="on-leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Qualifications</label>
          <input value={form.qualifications} onChange={e => set('qualifications', e.target.value)} placeholder="Certifications, licenses, or qualifications" className={inputCls} />
        </div>

        <div className="border border-gray-100 dark:border-white/10 rounded-xl p-4 bg-gray-50 dark:bg-white/5">
          <div className="flex items-center gap-2 mb-3">
            <WalletCards className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Salary & Commission</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Pay Type</label>
              <select value={form.compensationType} onChange={e => set('compensationType', e.target.value)} className={inputCls}>
                <option value="fixed">Fixed salary</option>
                <option value="commission">Commission only</option>
                <option value="hybrid">Salary + commission</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Fixed Salary</label>
              <input type="number" value={form.fixedSalary} onChange={e => set('fixedSalary', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Default Commission %</label>
              <input type="number" value={form.commissionRate} onChange={e => set('commissionRate', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <input type="number" value={form.consultationRate} onChange={e => set('consultationRate', e.target.value)} aria-label="Consultation commission" className={inputCls} />
            <input type="number" value={form.procedureRate} onChange={e => set('procedureRate', e.target.value)} aria-label="Procedure commission" className={inputCls} />
            <input type="number" value={form.packageRate} onChange={e => set('packageRate', e.target.value)} aria-label="Package commission" className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Consultation %</span><span>{treatmentLabel} %</span><span>Package %</span>
          </div>
        </div>

        {!isEdit && (
          <div className="border border-indigo-100 dark:border-indigo-500/30 rounded-xl p-4 bg-indigo-50 dark:bg-indigo-500/10">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Login Credentials</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={form.portalRole} onChange={e => set('portalRole', e.target.value)} className="border border-indigo-100 dark:border-indigo-500/30 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm">
                <option value="doctor">{doctorLabel}</option>
                <option value="staff">{staffLabel}</option>
                <option value="receptionist">Receptionist</option>
                <option value="manager">Manager</option>
              </select>
              <label className="flex items-center gap-2 text-xs font-medium text-indigo-900 dark:text-indigo-200 bg-white dark:bg-white/5 rounded-lg px-3 py-2 border border-indigo-100 dark:border-indigo-500/30">
                <input type="checkbox" checked={form.sendWhatsapp} onChange={e => set('sendWhatsapp', e.target.checked)} /> WhatsApp invite
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-indigo-900 dark:text-indigo-200 bg-white dark:bg-white/5 rounded-lg px-3 py-2 border border-indigo-100 dark:border-indigo-500/30">
                <input type="checkbox" checked={form.sendEmail} onChange={e => set('sendEmail', e.target.checked)} /> Email invite
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="primary" className="flex-1 justify-center" onClick={submit} disabled={saving}>
            {isEdit ? <><Save className="w-4 h-4" /> Save Changes</> : <><Send className="w-4 h-4" /> Create & Send Credentials</>}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, name, deleting }) {
  const { term } = useClinic();
  const staffLabel = term('staff', 'Staff');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Remove ${staffLabel}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Deactivate <span className="font-semibold">{name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={deleting}>
            <Trash2 className="w-4 h-4" /> {deleting ? 'Removing...' : 'Remove'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Staff() {
  const { clinicInfo, term } = useClinic();
  const staffLabel = term('staff', 'Staff');
  const [staffList, setStaffList] = useState(() => {
    const c = peekApiCacheByPrefix('/staff');
    return Array.isArray(c) ? c : [];
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const loadStaff = async () => {
    try {
      const data = await fetchApi('/staff');
      setStaffList(Array.isArray(data) ? data : (data.staff ?? data.data ?? []));
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);

  const handleSave = async (payload, invitePrefs) => {
    setSaving(true);
    setError('');
    try {
      if (editTarget) {
        await fetchApi(`/staff/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        const created = await fetchApi('/staff', { method: 'POST', body: JSON.stringify(payload) });
        // Send invite messages if requested
        const staffForMessage = { ...payload, ...created, tempPassword: created?.tempPassword || `${makeInitials(payload.name)}@${new Date().getFullYear()}` };
        const message = buildCredentialMessage(staffForMessage, clinicInfo);
        if (invitePrefs.sendWhatsapp && payload.phone) {
          window.open(`https://wa.me/${payload.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
        }
        if (invitePrefs.sendEmail) {
          window.location.href = `mailto:${payload.email}?subject=${encodeURIComponent(`${clinicInfo.name} staff portal access`)}&body=${encodeURIComponent(message)}`;
        }
      }
      setShowAddModal(false);
      setEditTarget(null);
      await loadStaff();
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
      await fetchApi(`/staff/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadStaff();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    return staffList.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      return true;
    });
  }, [staffList, statusFilter]);

  const onDuty = staffList.filter(s => s.status === 'active').length;
  const payrollEstimate = staffList.reduce((sum, staff) => sum + (Number(staff.fixedSalary) || 0) + ((Number(staff.revenue) || 0) * (Number(staff.commissionRate) || 0)) / 100, 0);

  if (loading && staffList.length === 0) {
    return <div className="space-y-4"><TableSkeleton rows={6} cols={4} /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Total ${staffLabel}`, value: staffList.length, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-white/5' },
          { label: 'On Duty Today', value: onDuty, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'On Leave', value: staffList.filter(s => s.status === 'on-leave').length, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
          { label: 'Payroll + Commission', value: money(payrollEstimate), color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-white/5">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on-leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <Button onClick={() => { setEditTarget(null); setShowAddModal(true); }} size="sm">
          <Plus className="w-4 h-4" /> Add {staffLabel}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(staff => (
          <div key={staff.id}
            onClick={() => setSelectedStaff(staff)}
            className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-indigo-100 transition-all duration-200 group relative">
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); setEditTarget(staff); setShowAddModal(true); }}
                className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-white/10 text-gray-400 hover:text-indigo-600">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(staff); }}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-start justify-between mb-4 pr-16">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0"
                  style={{ background: staff.avatarColor || '#6366f1' }}>
                  {staff.avatar || makeInitials(staff.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{staff.name}</p>
                  <p className="text-xs text-gray-400">{staff.role}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              {staff.status && <Badge label={staff.status} variant={staff.status} />}
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{staff.rating || 0}</span>
              </div>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{staff.experience || 'New'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50 dark:border-white/10">
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.appointmentsThisMonth || 0}</p>
                <p className="text-[10px] text-gray-400">This month</p>
              </div>
              <div className="text-center border-x border-gray-50 dark:border-white/10">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{staff.appointmentsHandled || 0}</p>
                <p className="text-[10px] text-gray-400">All time</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-600">
                  {staff.revenue > 0 ? `${(staff.revenue / 1000000).toFixed(1)}M` : '—'}
                </p>
                <p className="text-[10px] text-gray-400">Revenue</p>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400 text-sm">No {staffLabel.toLowerCase()} found.</div>
        )}
      </div>

      <StaffDetailModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} />
      <StaffFormModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditTarget(null); }}
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
