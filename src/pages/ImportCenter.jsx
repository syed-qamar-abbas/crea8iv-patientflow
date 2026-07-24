import { useEffect, useState } from 'react';
import { Database, Edit2, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import { fetchApi } from '../config/api';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { useClinic } from '../context/ClinicContext';

const emptyJob = { sourceType: 'csv', fileName: '', entityType: 'patients', status: 'preview_ready', totalRows: 0, validRows: 0, duplicateRows: 0, fieldMapping: {}, validationNotes: [] };

export default function ImportCenter() {
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const patientsLabel = term('patients', 'Patients');
  const appointmentsLabel = term('appointments', 'Appointments');
  const treatmentLabel = term('treatment', 'Treatment');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyJob);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setJobs(await fetchApi('/import/jobs'));
    } catch (err) {
      setError(err.message || 'Import jobs could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => setForm(editJob ? { ...emptyJob, ...editJob } : emptyJob), [editJob, showForm]);

  const save = async () => {
    const payload = { ...form, totalRows: Number(form.totalRows || 0), validRows: Number(form.validRows || 0), duplicateRows: Number(form.duplicateRows || 0) };
    setError('');
    try {
      if (editJob) await fetchApi(`/import/jobs/${editJob.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await fetchApi('/import/jobs', { method: 'POST', body: JSON.stringify(payload) });
      setShowForm(false); setEditJob(null); await load();
    } catch (err) {
      setError(err.message || 'Import job could not be saved.');
    }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await fetchApi(`/import/jobs/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Import job could not be deleted.');
    }
  };

  if (loading) return <div className="flex justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading imports...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-bold text-gray-900 dark:text-white">Import & Migration Center</h1><p className="mt-1 text-sm text-gray-500">Track CSV, Excel, Google Sheets and CRM migration jobs with mapping and validation status.</p></div>
        <Button onClick={() => { setEditJob(null); setShowForm(true); }}><Plus className="h-4 w-4" /> New Import Job</Button>
      </div>
      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Jobs', jobs.length],
          ['Rows Imported', jobs.reduce((sum, j) => sum + Number(j.importedRows || 0), 0)],
          ['Duplicates Found', jobs.reduce((sum, j) => sum + Number(j.duplicateRows || 0), 0)],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"><Database className="h-5 w-5 text-teal-700" /><p className="mt-4 text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-gray-500">{label}</p></div>)}
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50 p-5 text-sm text-teal-900">
        <UploadCloud className="h-6 w-6" />
        <p className="mt-3 font-black">Migration workflow</p>
        <p className="mt-1 text-xs leading-5">Upload source to map fields to validate duplicates to preview to import into {patientsLabel}, {appointmentsLabel}, {treatmentLabel}s, Notes, or Financial Records.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['Source', 'Entity', 'Rows', 'Valid', 'Duplicates', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {jobs.map(job => <tr key={job.id}><td className="px-4 py-3 font-bold">{job.fileName || job.sourceType}</td><td className="px-4 py-3">{job.entityType}</td><td className="px-4 py-3">{job.totalRows}</td><td className="px-4 py-3">{job.validRows}</td><td className="px-4 py-3">{job.duplicateRows}</td><td className="px-4 py-3"><Badge label={job.status} variant={job.status === 'completed' ? 'active' : 'pending'} /></td><td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => { setEditJob(job); setShowForm(true); }} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button><button onClick={() => setDeleteTarget(job)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
            {jobs.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">No import jobs yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditJob(null); }} title={editJob ? 'Edit Import Job' : 'New Import Job'} size="lg">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><select className="premium-input rounded-lg px-3 py-2 text-sm" value={form.sourceType} onChange={e => setForm({ ...form, sourceType: e.target.value })}><option>csv</option><option>xlsx</option><option>google_sheets</option><option>crm_export</option></select><input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="File/source name" value={form.fileName || ''} onChange={e => setForm({ ...form, fileName: e.target.value })} /><select className="premium-input rounded-lg px-3 py-2 text-sm" value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value })}><option value="patients">{patientsLabel}</option><option value="appointments">{appointmentsLabel}</option><option value="treatments">{treatmentLabel}s</option><option value="financials">financials</option><option value="notes">notes</option></select></div>
          <div className="grid gap-3 sm:grid-cols-4"><input type="number" className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Total rows" value={form.totalRows} onChange={e => setForm({ ...form, totalRows: e.target.value })} /><input type="number" className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Valid rows" value={form.validRows} onChange={e => setForm({ ...form, validRows: e.target.value })} /><input type="number" className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Duplicates" value={form.duplicateRows} onChange={e => setForm({ ...form, duplicateRows: e.target.value })} /><select className="premium-input rounded-lg px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>draft</option><option>preview_ready</option><option>validated</option><option>completed</option><option>failed</option></select></div>
          <textarea className="premium-input w-full rounded-lg px-3 py-2 text-sm" rows={4} placeholder={`Field mapping JSON e.g. {"name":"${patientLabel} Name","phone":"Mobile"}`} value={JSON.stringify(form.fieldMapping || {}, null, 2)} onChange={e => { try { setForm({ ...form, fieldMapping: JSON.parse(e.target.value || '{}') }); } catch { /* keep editing */ } }} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={save}>Save Job</Button></div>
        </div>
      </Modal>
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Import Job" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
            <p className="text-sm font-bold">Delete this import job?</p>
            <p className="mt-1 text-xs leading-5">{deleteTarget?.fileName || deleteTarget?.sourceType} will be removed from migration tracking.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
