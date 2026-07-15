import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useClinic } from '../context/ClinicContext';
import {
  Building2, Palette, Bell, Shield, Save, Check,
  ToggleLeft, ToggleRight, ChevronRight, FileText, MessageCircle,
  Users as UsersIcon, KeyRound, Pencil, Trash2, Plus, AlertCircle, Eye, EyeOff,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ColorPicker from '../components/ui/ColorPicker';
import ClinicLogoMark from '../components/branding/ClinicLogoMark';
import { fetchApi, fetchPublicApi } from '../config/api';
import { getLogoInitials, isImageLogo } from '../utils/branding';
import { missingClinicFields, isFilled } from '../config/requiredSettings';

const PORTAL_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'therapist', label: 'Therapist' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'receptionist', label: 'Receptionist' },
];

const ROLE_BADGE_VARIANT = {
  owner: 'Platinum',
  manager: 'Gold',
  doctor: 'dental',
  therapist: 'active',
  accountant: 'completed',
  receptionist: 'pending',
};

function suggestUsername(value) {
  return String(value || '')
    .toLowerCase()
    .split('@')[0]
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[._-]{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24);
}

function useUsernameAvailability(username, excludeUserId = '') {
  const [state, setState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    const value = String(username || '').trim().toLowerCase();
    if (!value) {
      setState({ status: 'idle', message: '' });
      return undefined;
    }
    if (value.length < 3) {
      setState({ status: 'invalid', message: 'Use at least 3 characters.' });
      return undefined;
    }

    setState({ status: 'checking', message: 'Checking availability...' });
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ username: value });
        if (excludeUserId) qs.set('excludeUserId', excludeUserId);
        const res = await fetchPublicApi(`/auth/username-availability?${qs.toString()}`);
        if (!res.valid) {
          setState({ status: 'invalid', message: res.message || 'Invalid username.' });
        } else if (res.available) {
          setState({ status: 'available', message: 'Username is available.' });
        } else {
          setState({ status: 'taken', message: 'Username is already taken.' });
        }
      } catch (err) {
        setState({ status: 'invalid', message: err.message || 'Could not check username.' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username, excludeUserId]);

  return state;
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('clinic_user') || 'null');
  } catch {
    return null;
  }
}

function AccountManagement() {
  const { term } = useClinic();
  const doctorLabel = term('doctor', 'Doctor');
  const clinicLabel = term('clinic', 'clinic');
  const roleOptions = PORTAL_ROLES.map(role => role.value === 'doctor' ? { ...role, label: doctorLabel } : role);
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Add form
  const [addForm, setAddForm] = useState({ name: '', username: '', phone: '', whatsapp: '', email: '', password: '', role: 'receptionist' });
  // Edit form
  const [editForm, setEditForm] = useState({ name: '', username: '', phone: '', whatsapp: '', email: '', role: 'receptionist' });
  // Reset form
  const [resetForm, setResetForm] = useState({ newPassword: '', confirm: '' });
  const [showResetPass, setShowResetPass] = useState(false);
  const addUsername = useUsernameAvailability(addForm.username);
  const editUsername = useUsernameAvailability(editForm.username, editUser?.id || '');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (u) => {
    setEditForm({ name: u.name || '', username: u.username || suggestUsername(u.email || u.name), phone: u.phone || '', whatsapp: u.whatsapp || '', email: u.email || '', role: u.role || 'receptionist' });
    setFormError('');
    setEditUser(u);
  };

  const openReset = (u) => {
    setResetForm({ newPassword: '', confirm: '' });
    setFormError('');
    setResetUser(u);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setBusy(true); setFormError('');
    try {
      await fetchApi('/users', { method: 'POST', body: JSON.stringify(addForm) });
      setAddOpen(false);
      setAddForm({ name: '', username: '', phone: '', whatsapp: '', email: '', password: '', role: 'receptionist' });
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
    } finally { setBusy(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setBusy(true); setFormError('');
    try {
      await fetchApi(`/users/${editUser.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditUser(null);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to update user');
    } finally { setBusy(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetUser) return;
    if (resetForm.newPassword.length < 10) {
      setFormError('Password must be at least 10 characters');
      return;
    }
    if (resetForm.newPassword !== resetForm.confirm) {
      setFormError('Passwords do not match');
      return;
    }
    setBusy(true); setFormError('');
    try {
      await fetchApi(`/users/${resetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetForm.newPassword }),
      });
      setResetUser(null);
    } catch (err) {
      setFormError(err.message || 'Failed to reset password');
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setBusy(true); setFormError('');
    try {
      await fetchApi(`/users/${deleteUser.id}`, { method: 'DELETE' });
      setDeleteUser(null);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to delete user');
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-lg shrink-0"
            style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
          >
            <UsersIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Account Management</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Manage portal users, roles, and credentials for your {clinicLabel.toLowerCase()}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setAddForm({ name: '', username: '', phone: '', whatsapp: '', email: '', password: '', role: 'receptionist' }); setFormError(''); setAddOpen(true); }}>
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs px-3 py-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">No users yet.</div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <th className="py-2 px-5 font-semibold">Name</th>
                <th className="py-2 px-2 font-semibold">Username</th>
                <th className="py-2 px-2 font-semibold">Role</th>
                <th className="py-2 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentUser && u.id === currentUser.id;
                return (
                  <tr key={u.id} className="border-t border-gray-100 dark:border-white/10">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</span>
                        {isSelf && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{u.username || 'Not set'}</span>
                      {(u.phone || u.whatsapp || u.email) && (
                        <span className="block text-[11px] text-gray-400">
                          {[u.whatsapp || u.phone, u.email].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge label={u.role} variant={ROLE_BADGE_VARIANT[u.role] || 'inactive'} />
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openReset(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                          title="Reset password"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Reset
                        </button>
                        <button
                          onClick={() => openEdit(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: 'var(--primary)' }}
                          title="Edit user"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => { setFormError(''); setDeleteUser(u); }}
                          disabled={isSelf}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isSelf ? 'You cannot delete yourself' : 'Delete user'}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={addOpen} onClose={() => !busy && setAddOpen(false)} title="Add New User" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Full Name</label>
            <input required value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value, username: f.username || suggestUsername(e.target.value) }))} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Username</label>
            <input required value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value.toLowerCase() })} autoComplete="username" className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
            {addUsername.message && (
              <p className={`mt-1 text-[11px] font-semibold ${addUsername.status === 'available' ? 'text-emerald-600' : addUsername.status === 'checking' ? 'text-gray-400' : 'text-rose-600'}`}>{addUsername.message}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone</label>
              <input type="tel" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="+92..." className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">WhatsApp</label>
              <input type="tel" value={addForm.whatsapp} onChange={(e) => setAddForm({ ...addForm, whatsapp: e.target.value })} placeholder="+92..." className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Contact Email <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="Optional recovery/contact email" className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Password</label>
            <div className="relative">
              <input type={showResetPass ? 'text' : 'password'} required minLength={10} value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
              <button type="button" onClick={() => setShowResetPass((v) => !v)} title={showResetPass ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Role</label>
            <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40">
              {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {formError && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || addUsername.status !== 'available'}>{busy ? 'Creating…' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editUser} onClose={() => !busy && setEditUser(null)} title="Edit User" size="md">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Full Name</label>
            <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Username</label>
            <input required value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase() })} autoComplete="username" className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
            {editUsername.message && (
              <p className={`mt-1 text-[11px] font-semibold ${editUsername.status === 'available' ? 'text-emerald-600' : editUsername.status === 'checking' ? 'text-gray-400' : 'text-rose-600'}`}>{editUsername.message}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone</label>
              <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+92..." className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">WhatsApp</label>
              <input type="tel" value={editForm.whatsapp} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} placeholder="+92..." className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Contact Email <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Optional recovery/contact email" className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Role</label>
            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40">
              {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {formError && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditUser(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || editUsername.status !== 'available'}>{busy ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetUser} onClose={() => !busy && setResetUser(null)} title={`Reset Password${resetUser ? ` — ${resetUser.name}` : ''}`} size="sm">
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">New Password</label>
            <div className="relative">
              <input type={showResetPass ? 'text' : 'password'} required minLength={10} value={resetForm.newPassword} onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
              <button type="button" onClick={() => setShowResetPass((v) => !v)} title={showResetPass ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Confirm Password</label>
            <input type={showResetPass ? 'text' : 'password'} required minLength={10} value={resetForm.confirm} onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })} className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40" />
          </div>
          {formError && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setResetUser(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Resetting…' : 'Reset Password'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteUser} onClose={() => !busy && setDeleteUser(null)} title="Delete User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to deactivate <span className="font-semibold">{deleteUser?.name}</span> ({deleteUser?.username || deleteUser?.email})?
            The account will be disabled and its active sessions will be revoked.
          </p>
          {formError && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteUser(null)} disabled={busy}>Cancel</Button>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={busy}>
              {busy ? 'Deactivating…' : 'Deactivate User'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100">
      <div className="p-2 rounded-lg shrink-0" style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative flex items-center transition-colors duration-200 ${checked ? 'text-indigo-600' : 'text-gray-300'}`}
      >
        {checked ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
      </button>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme, clinicName, setClinicName } = useTheme();
  const { clinicInfo, updateClinicInfo, term } = useClinic();
  const clinicLabel = term('clinic', 'Clinic');
  const patientLabel = term('patient', 'patient');
  const appointmentLabel = term('appointment', 'appointment');
  const appointmentsLabel = term('appointments', 'appointments');
  const doctorLabel = term('doctor', 'Doctor');
  const staffLabel = term('staff', 'staff');
  const serviceLabel = term('service', 'service');
  const servicesLabel = term('services', 'Services');
  const recallLabel = term('recall', 'recall');

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localName, setLocalName] = useState(clinicInfo.name || clinicName);
  const [localPrimary, setLocalPrimary] = useState(theme.primary);
  const [localSecondary, setLocalSecondary] = useState(theme.secondary);
  const [localFont, setLocalFont] = useState(theme.font);
  const [localAddress, setLocalAddress] = useState(clinicInfo.address);
  const [localPhone, setLocalPhone] = useState(clinicInfo.phone);
  const [localEmail, setLocalEmail] = useState(clinicInfo.email);
  const [localLogo, setLocalLogo] = useState(clinicInfo.logo);
  const [localTagline, setLocalTagline] = useState(clinicInfo.tagline);
  const [localWhatsapp, setLocalWhatsapp] = useState(clinicInfo.whatsapp || '');
  const [localWebsite, setLocalWebsite] = useState(clinicInfo.website || '');
  const [localRegistrationNo, setLocalRegistrationNo] = useState(clinicInfo.registrationNo || '');
  const [localInvoicePrefix, setLocalInvoicePrefix] = useState(clinicInfo.invoicePrefix || 'AC');
  const [localInvoiceFooter, setLocalInvoiceFooter] = useState(clinicInfo.invoiceFooter || '');
  const [localPaymentTerms, setLocalPaymentTerms] = useState(clinicInfo.paymentTerms || '');
  const [localBankName, setLocalBankName] = useState(clinicInfo.bankName || '');
  const [localBankBranch, setLocalBankBranch] = useState(clinicInfo.bankBranch || '');
  const [localAccountTitle, setLocalAccountTitle] = useState(clinicInfo.accountTitle || '');
  const [localAccountNumber, setLocalAccountNumber] = useState(clinicInfo.accountNumber || '');
  const [localIban, setLocalIban] = useState(clinicInfo.iban || '');
  const [localPaymentNote, setLocalPaymentNote] = useState(clinicInfo.paymentNote || '');
  const [localStamp, setLocalStamp] = useState(clinicInfo.stampImage || '');
  const [stampError, setStampError] = useState('');
  const [localMission, setLocalMission] = useState(clinicInfo.mission || '');
  const [localVision, setLocalVision] = useState(clinicInfo.vision || '');
  const [localServicesOverview, setLocalServicesOverview] = useState(clinicInfo.servicesOverview || '');
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    // The server (Clinic table) is the source of truth — seed the form from it
    // so saved edits survive logout/login instead of falling back to cached or
    // default branding.
    let cancelled = false;
    fetchApi('/settings/public-site')
      .then(({ clinic }) => {
        if (cancelled || !clinic) return;
        const v = (x, fallback = '') => (x === null || x === undefined ? fallback : x);
        if (clinic.name) { setLocalName(clinic.name); setClinicName(clinic.name); }
        setLocalTagline(v(clinic.tagline));
        if (clinic.logo) setLocalLogo(clinic.logo);
        setLocalAddress(v(clinic.address));
        setLocalPhone(v(clinic.phone));
        setLocalEmail(v(clinic.email));
        setLocalWhatsapp(v(clinic.whatsapp));
        setLocalWebsite(v(clinic.website));
        setLocalRegistrationNo(v(clinic.registrationNo));
        if (clinic.invoicePrefix) setLocalInvoicePrefix(clinic.invoicePrefix);
        setLocalInvoiceFooter(v(clinic.invoiceFooter));
        setLocalPaymentTerms(v(clinic.paymentTerms));
        setLocalBankName(v(clinic.bankName));
        setLocalBankBranch(v(clinic.bankBranch));
        setLocalAccountTitle(v(clinic.accountTitle));
        setLocalAccountNumber(v(clinic.accountNumber));
        setLocalIban(v(clinic.iban));
        setLocalPaymentNote(v(clinic.paymentNote));
        setLocalStamp(v(clinic.stampImage));
        setLocalMission(v(clinic.mission));
        setLocalVision(v(clinic.vision));
        setLocalServicesOverview(v(clinic.servicesOverview));
        if (clinic.primaryColor) setLocalPrimary(clinic.primaryColor);
        if (clinic.secondaryColor) setLocalSecondary(clinic.secondaryColor);
        if (clinic.font) setLocalFont(clinic.font);
      })
      .catch(() => { /* roles without access keep context values */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [notifications, setNotifications] = useState({
    smsReminders: true,
    emailReminders: true,
    pushNotifications: true,
    birthdayMessages: true,
    packageExpiry: true,
    staffAlerts: true,
    marketingEmails: false,
    whatsappGrowth: true,
  });

  const toggleNotif = (key) => setNotifications(n => ({ ...n, [key]: !n[key] }));

  const handleStampUpload = (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setStampError('Please choose a valid image file.'); return; }
    if (file.size > 1.5 * 1024 * 1024) { setStampError('Stamp/signature must be 1.5MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setLocalStamp(typeof reader.result === 'string' ? reader.result : localStamp); setStampError(''); };
    reader.onerror = () => setStampError('Could not read the selected file. Please try again.');
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose a valid image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo must be 2MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLocalLogo(typeof reader.result === 'string' ? reader.result : localLogo);
      setLogoError('');
    };
    reader.onerror = () => {
      setLogoError('Could not read the selected file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setClinicName(localName);
    setTheme({ primary: localPrimary, secondary: localSecondary, font: localFont });
    updateClinicInfo({
      name: localName,
      tagline: localTagline,
      logo: localLogo,
      address: localAddress,
      phone: localPhone,
      whatsapp: localWhatsapp,
      email: localEmail,
      website: localWebsite,
      registrationNo: localRegistrationNo,
      invoicePrefix: localInvoicePrefix,
      invoiceFooter: localInvoiceFooter,
      paymentTerms: localPaymentTerms,
      bankName: localBankName,
      bankBranch: localBankBranch,
      accountTitle: localAccountTitle,
      accountNumber: localAccountNumber,
      iban: localIban,
      paymentNote: localPaymentNote,
      stampImage: localStamp,
      mission: localMission,
      vision: localVision,
      servicesOverview: localServicesOverview,
      primaryColor: localPrimary,
      secondaryColor: localSecondary,
      font: localFont,
    });
    try {
      const current = await fetchApi('/settings/public-site');
      await fetchApi('/settings/public-site', {
        method: 'PUT',
        body: JSON.stringify({
          clinic: {
            name: localName, tagline: localTagline, logo: localLogo, address: localAddress,
            phone: localPhone, whatsapp: localWhatsapp, email: localEmail, website: localWebsite,
            registrationNo: localRegistrationNo, invoicePrefix: localInvoicePrefix,
            invoiceFooter: localInvoiceFooter, paymentTerms: localPaymentTerms,
            bankName: localBankName, bankBranch: localBankBranch, accountTitle: localAccountTitle, accountNumber: localAccountNumber,
            iban: localIban, paymentNote: localPaymentNote, stampImage: localStamp, mission: localMission,
            vision: localVision, servicesOverview: localServicesOverview, primaryColor: localPrimary,
            secondaryColor: localSecondary, font: localFont,
          },
          config: current.config,
        }),
      });
      setLogoError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setLogoError(`Could not save server settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const requiredValues = {
    name: localName, address: localAddress, phone: localPhone, email: localEmail,
    invoicePrefix: localInvoicePrefix, paymentTerms: localPaymentTerms, invoiceFooter: localInvoiceFooter,
    bankName: localBankName, accountTitle: localAccountTitle, accountNumber: localAccountNumber, iban: localIban,
  };
  const missingRequired = missingClinicFields(requiredValues);
  // Red border helper for required fields that are still empty.
  const reqCls = (val) => (isFilled(val) ? 'border-gray-200' : 'border-red-400 ring-1 ring-red-200');

  return (
    <div className="max-w-5xl space-y-5">
      {/* Save bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-gray-900">{clinicLabel} Configuration</p>
          <p className="text-xs text-gray-400">Changes apply instantly across all modules</p>
        </div>
        <Button onClick={handleSave} size="sm" className="min-w-[110px] justify-center" disabled={saving}>
          {saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}</>
          )}
        </Button>
      </div>

      {/* Required-fields alert */}
      {missingRequired.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-bold text-red-800">
            {missingRequired.length} required {missingRequired.length === 1 ? 'detail is' : 'details are'} missing
          </p>
          <p className="mt-0.5 text-xs text-red-700">
            These appear on invoices and {patientLabel} documents. Complete the fields highlighted in red, then Save.
          </p>
          <p className="mt-2 text-xs text-red-700"><span className="font-semibold">Missing:</span> {missingRequired.map((f) => f.label).join(', ')}</p>
        </div>
      )}

      {/* Clinic Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <SectionHeader icon={Building2} title={`${clinicLabel} Information`} description="Basic details shown across the platform" />
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{clinicLabel} Name</label>
            <input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              className={`w-full border ${reqCls(localName)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Logo Initials</label>
              <input
                value={isImageLogo(localLogo) ? '' : localLogo}
                onChange={e => setLocalLogo(e.target.value.slice(0, 4).toUpperCase())}
                placeholder={isImageLogo(localLogo) ? 'Image logo uploaded' : 'SE'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <p className="text-[10px] text-gray-400 mt-1.5">Use initials for a text mark, or upload an image below.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tagline</label>
              <input
                value={localTagline}
                onChange={e => setLocalTagline(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
            <input
              value={localAddress}
              onChange={e => setLocalAddress(e.target.value)}
              className={`w-full border ${reqCls(localAddress)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input
                value={localPhone}
                onChange={e => setLocalPhone(e.target.value)}
                className={`w-full border ${reqCls(localPhone)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input
                value={localEmail}
                onChange={e => setLocalEmail(e.target.value)}
                className={`w-full border ${reqCls(localEmail)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp</label>
              <input value={localWhatsapp} onChange={e => setLocalWhatsapp(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
              <input value={localWebsite} onChange={e => setLocalWebsite(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Registration / NTN</label>
              <input value={localRegistrationNo} onChange={e => setLocalRegistrationNo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Active Branches</label>
            <div className="flex flex-wrap gap-2">
              {clinicInfo.branches.map(branch => (
                <div key={branch} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-gray-700">{branch}</span>
                  {branch === clinicInfo.activeBranch && (
                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Active</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Brand Profile */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <SectionHeader icon={FileText} title="Brand Profile & Invoice Rules" description={`Controls invoice headers, ${patientLabel} documents, and ${clinicLabel.toLowerCase()} messaging`} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mission</label>
            <textarea rows={3} value={localMission} onChange={e => setLocalMission(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Vision</label>
            <textarea rows={3} value={localVision} onChange={e => setLocalVision(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">{servicesLabel} Overview</label>
            <textarea rows={3} value={localServicesOverview} onChange={e => setLocalServicesOverview(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Invoice Prefix</label>
            <input value={localInvoicePrefix} onChange={e => setLocalInvoicePrefix(e.target.value.toUpperCase())} className={`w-full border ${reqCls(localInvoicePrefix)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Terms</label>
            <textarea rows={4} value={localPaymentTerms} onChange={e => setLocalPaymentTerms(e.target.value)} placeholder={`One point per line - shown as bullets on the invoice:\nPayment due at time of ${serviceLabel}\nBalance to be cleared within 7 days\nDocuments collected after full payment`} className={`w-full border ${reqCls(localPaymentTerms)} rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300`} />
            <p className="text-[10px] text-gray-400 mt-1">Write each term on its own line. Each line becomes a bullet on the invoice.</p>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Invoice Footer Message</label>
            <input value={localInvoiceFooter} onChange={e => setLocalInvoiceFooter(e.target.value)} className={`w-full border ${reqCls(localInvoiceFooter)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`} />
          </div>

          <div className="lg:col-span-2 mt-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Payment / Account Details</p>
            <p className="text-[11px] text-gray-400">Shown on every invoice so {patientLabel}s know where to pay. Leave blank to hide.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Bank Name</label>
            <input value={localBankName} onChange={e => setLocalBankName(e.target.value)} placeholder="e.g. Faysal Bank" className={`w-full border ${reqCls(localBankName)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Branch Name</label>
            <input value={localBankBranch} onChange={e => setLocalBankBranch(e.target.value)} placeholder="e.g. IBB F-8 Markaz, Islamabad" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Account Title</label>
            <input value={localAccountTitle} onChange={e => setLocalAccountTitle(e.target.value)} placeholder="e.g. The Smile Xperts" className={`w-full border ${reqCls(localAccountTitle)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Account Number</label>
            <input value={localAccountNumber} onChange={e => setLocalAccountNumber(e.target.value)} placeholder="e.g. 0123-4567890123" className={`w-full border ${reqCls(localAccountNumber)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">IBAN</label>
            <input value={localIban} onChange={e => setLocalIban(e.target.value.toUpperCase())} placeholder="e.g. PK00MEZN0000000000000000" className={`w-full border ${reqCls(localIban)} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`} />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Note (optional)</label>
            <input value={localPaymentNote} onChange={e => setLocalPaymentNote(e.target.value)} placeholder="e.g. JazzCash/Easypaisa: 0300-1234567 — send receipt on WhatsApp" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Stamp / Signature (optional)</label>
            <p className="text-[11px] text-gray-400 mb-2">Shown in the signature area of every invoice. Use a transparent PNG of your {clinicLabel.toLowerCase()} stamp or an authorized signature.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-16 w-32 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                {localStamp
                  ? <img src={localStamp} alt="Stamp / signature preview" className="max-h-14 max-w-[120px] object-contain" />
                  : <span className="text-[10px] text-gray-300">No stamp</span>}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="cursor-pointer bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    {localStamp ? 'Replace' : 'Upload'} Stamp / Signature
                    <input type="file" accept="image/*" className="hidden" onChange={handleStampUpload} />
                  </label>
                  {localStamp && (
                    <button type="button" onClick={() => { setLocalStamp(''); setStampError(''); }} className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">Remove</button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">PNG (transparent recommended), max 1.5MB.</p>
                {stampError && <p className="text-[10px] text-red-500">{stampError}</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <ClinicLogoMark logo={localLogo} alt={`${localName} logo preview`} className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 overflow-hidden" style={{ background: localPrimary }} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{localName || `${clinicLabel} Name`}</p>
              <p className="text-xs text-gray-500">{localTagline}</p>
              <p className="text-xs text-gray-500 mt-1">{localAddress}</p>
              <p className="text-xs text-gray-500">{localPhone} · {localEmail}</p>
              <p className="text-xs text-gray-500">{localWebsite} · {localRegistrationNo}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <SectionHeader icon={Palette} title="Branding & Appearance" description="Customize colors, fonts, and visual identity" />

        <div className="space-y-5">
          {/* Color preview */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <ClinicLogoMark logo={localLogo} alt={`${localName} app icon preview`} className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow overflow-hidden" style={{ background: localPrimary }} />
            <div className="flex-1">
              <div className="h-2 rounded-full mb-2" style={{ background: localPrimary, width: '60%' }} />
              <div className="h-1.5 rounded-full bg-gray-200" style={{ width: '80%' }} />
            </div>
            <div className="text-xs text-gray-400 font-mono">{localPrimary}</div>
          </div>

          {/* Primary color — precise hex + RGB picker */}
          <ColorPicker label="Primary Color" value={localPrimary} onChange={setLocalPrimary} />

          {/* Secondary color */}
          <ColorPicker label="Accent Color" value={localSecondary} onChange={setLocalSecondary} />

          {/* Font */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Interface Font</label>
            <select
              value={localFont}
              onChange={e => setLocalFont(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full sm:w-auto"
            >
              <option value="Inter">Inter (Default)</option>
              <option value="Poppins">Poppins</option>
              <option value="DM Sans">DM Sans</option>
              <option value="Nunito">Nunito</option>
              <option value="Outfit">Outfit</option>
            </select>
          </div>

          {/* Logo upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">{clinicLabel} Logo</label>
            <div className="flex items-center gap-3 flex-wrap">
              <ClinicLogoMark
                logo={localLogo}
                alt={`${localName} logo preview`}
                className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow overflow-hidden"
                textClassName="text-white font-bold text-lg"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="cursor-pointer bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    {isImageLogo(localLogo) ? 'Replace Logo' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  {isImageLogo(localLogo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalLogo(getLogoInitials(localName));
                        setLogoError('');
                      }}
                      className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Use Initials
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">PNG or SVG, max 2MB. Recommended square image, at least 512×512px.</p>
                <p className="text-[10px] text-gray-400">Used across the portal, login screen, public website, browser tab, and installed mobile shortcut.</p>
                {logoError && (
                  <p className="text-[10px] text-red-500">{logoError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <SectionHeader icon={Bell} title="Notifications & Automation" description="Configure when and how to contact clients and staff" />
        <div className="space-y-0">
          <ToggleRow
            label={`SMS ${appointmentLabel} Reminders`}
            description={`Send SMS 24h before each ${appointmentLabel}`}
            checked={notifications.smsReminders}
            onChange={() => toggleNotif('smsReminders')}
          />
          <ToggleRow
            label={`Email ${appointmentLabel} Reminders`}
            description="Send email confirmation and reminders"
            checked={notifications.emailReminders}
            onChange={() => toggleNotif('emailReminders')}
          />
          <ToggleRow
            label="Push Notifications"
            description="Real-time push to mobile devices"
            checked={notifications.pushNotifications}
            onChange={() => toggleNotif('pushNotifications')}
          />
          <ToggleRow
            label="Birthday Messages"
            description="Auto-send birthday wishes with a loyalty bonus"
            checked={notifications.birthdayMessages}
            onChange={() => toggleNotif('birthdayMessages')}
          />
          <ToggleRow
            label="Package Expiry Alerts"
            description="Notify clients when packages are about to expire"
            checked={notifications.packageExpiry}
            onChange={() => toggleNotif('packageExpiry')}
          />
          <ToggleRow
            label={`${staffLabel} Shift Alerts`}
            description={`Notify ${staffLabel.toLowerCase()} of upcoming shifts and schedule changes`}
            checked={notifications.staffAlerts}
            onChange={() => toggleNotif('staffAlerts')}
          />
          <ToggleRow
            label="Marketing Campaigns"
            description="Send promotional emails and offers to clients"
            checked={notifications.marketingEmails}
            onChange={() => toggleNotif('marketingEmails')}
          />
          <ToggleRow
            label="WhatsApp Growth Follow-ups"
            description={`Build monthly ${recallLabel.toLowerCase()} lists for due, inactive, and high-value ${patientLabel}s`}
            checked={notifications.whatsappGrowth !== false}
            onChange={() => toggleNotif('whatsappGrowth')}
          />
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-700 font-medium">WhatsApp sender: {localWhatsapp || `Add ${clinicLabel.toLowerCase()} WhatsApp number`}</p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <SectionHeader icon={Shield} title="Security & Access" description="Role-based access control and data protection" />
        <div className="space-y-2">
          {[
            { role: 'Owner', access: 'Full access — all modules, settings, and financials', color: 'bg-indigo-50 text-indigo-700' },
            { role: 'Manager', access: `${staffLabel}, ${appointmentsLabel}, clients, and reports`, color: 'bg-blue-50 text-blue-700' },
            { role: `${doctorLabel} / Specialist`, access: `Own ${appointmentsLabel} and client records`, color: 'bg-purple-50 text-purple-700' },
            { role: 'Receptionist', access: `${appointmentsLabel}, client intake, and invoice billing — no financial analytics`, color: 'bg-gray-100 text-gray-600' },
            { role: 'Accountant', access: 'Financial module and reports only', color: 'bg-emerald-50 text-emerald-700' },
          ].map(r => (
            <div key={r.role} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${r.color}`}>{r.role}</span>
                <p className="text-xs text-gray-500">{r.access}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </div>
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-700 font-medium">All {patientLabel} data is encrypted at rest. Automatic daily backups enabled.</p>
        </div>
      </div>

      {/* Account Management (owner only) */}
      {getCurrentUser()?.role === 'owner' && <AccountManagement />}

      {/* Bottom Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="md" disabled={saving}>
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save All Changes</>}
        </Button>
      </div>
    </div>
  );
}
