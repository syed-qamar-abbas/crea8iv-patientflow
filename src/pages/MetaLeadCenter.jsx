import { useEffect, useMemo, useState } from 'react';
import { Edit2, Loader2, Plus, Save, Trash2, UserPlus, Zap } from 'lucide-react';
import { fetchApi } from '../config/api';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const emptyLead = { patientName: '', phone: '', email: '', campaignName: '', adName: '', formName: '', status: 'new', notes: '' };

export default function MetaLeadCenter() {
  const [settings, setSettings] = useState({});
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLead, setShowLead] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsData, leadRows] = await Promise.all([fetchApi('/meta/settings'), fetchApi('/meta/leads')]);
      setSettings(settingsData);
      setLeads(leadRows);
    } catch (err) {
      setError(err.message || 'Meta leads could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setLeadForm(editLead ? { ...emptyLead, ...editLead } : emptyLead); setValidationError(''); }, [editLead, showLead]);

  const saveSettings = async () => {
    setError('');
    try {
      const updated = await fetchApi('/meta/settings', { method: 'PUT', body: JSON.stringify(settings) });
      setSettings(updated);
    } catch (err) {
      setError(err.message || 'Meta settings could not be saved.');
    }
  };
  const saveLead = async () => {
    setValidationError('');
    setError('');
    if (!leadForm.patientName.trim()) return setValidationError('Patient name is required.');
    try {
      if (editLead) await fetchApi(`/meta/leads/${editLead.id}`, { method: 'PUT', body: JSON.stringify(leadForm) });
      else await fetchApi('/meta/leads', { method: 'POST', body: JSON.stringify(leadForm) });
      setShowLead(false); setEditLead(null); await load();
    } catch (err) {
      setValidationError(err.message || 'Lead could not be saved.');
    }
  };
  const removeLead = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await fetchApi(`/meta/leads/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message || 'Lead could not be deleted.');
    }
  };
  const convertLead = async (lead) => {
    setError('');
    try {
      await fetchApi(`/meta/leads/${lead.id}/convert`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setError(err.message || 'Lead could not be converted.');
    }
  };

  const metrics = useMemo(() => ({
    total: leads.length,
    converted: leads.filter(l => l.status === 'converted').length,
    new: leads.filter(l => l.status === 'new').length,
  }), [leads]);

  if (loading) return <div className="flex justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading Meta leads...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-bold text-gray-900 dark:text-white">Meta Lead Center</h1><p className="mt-1 text-sm text-gray-500">Facebook/Instagram lead capture, attribution, CRM conversion and WhatsApp workflow foundation.</p></div>
        <Button onClick={() => { setEditLead(null); setShowLead(true); }}><Plus className="h-4 w-4" /> Add Lead</Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Total Leads', metrics.total],
          ['New Leads', metrics.new],
          ['Converted', metrics.converted],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"><Zap className="h-5 w-5 text-teal-700" /><p className="mt-4 text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-gray-500">{label}</p></div>)}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <h3 className="font-black">Meta API Settings</h3>
        <p className="mt-1 text-xs text-gray-500">Connect Page ID, Ad Account ID and token when ready. Token is not returned after saving.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Facebook Page ID" value={settings.pageId || ''} onChange={e => setSettings({ ...settings, pageId: e.target.value })} />
          <input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Ad Account ID" value={settings.adAccountId || ''} onChange={e => setSettings({ ...settings, adAccountId: e.target.value })} />
          <input type="password" className="premium-input rounded-lg px-3 py-2 text-sm" placeholder={settings.hasAccessToken ? 'Token saved - enter to replace' : 'Meta access token'} value={settings.accessToken || ''} onChange={e => setSettings({ ...settings, accessToken: e.target.value })} />
          <input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Webhook verify token" value={settings.webhookVerifyToken || ''} onChange={e => setSettings({ ...settings, webhookVerifyToken: e.target.value })} />
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-xs font-bold dark:border-white/10"><input type="checkbox" checked={!!Number(settings.syncEnabled)} onChange={e => setSettings({ ...settings, syncEnabled: e.target.checked })} /> Enable lead sync</label>
        </div>
        <Button className="mt-4" onClick={saveSettings}><Save className="h-4 w-4" /> Save Meta Settings</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['Patient', 'Contact', 'Campaign', 'Ad/Form', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map(lead => <tr key={lead.id}><td className="px-4 py-3 font-bold">{lead.patientName}</td><td className="px-4 py-3 text-xs">{lead.phone}<br />{lead.email}</td><td className="px-4 py-3 text-xs">{lead.campaignName || 'Manual'}</td><td className="px-4 py-3 text-xs">{lead.adName || '-'} / {lead.formName || '-'}</td><td className="px-4 py-3"><Badge label={lead.status} variant={lead.status === 'converted' ? 'active' : 'pending'} /></td><td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => convertLead(lead)} disabled={lead.status === 'converted'} className="rounded-lg p-2 text-gray-400 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-30"><UserPlus className="h-4 w-4" /></button><button onClick={() => { setEditLead(lead); setShowLead(true); }} className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"><Edit2 className="h-4 w-4" /></button><button onClick={() => setDeleteTarget(lead)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
            {leads.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No Meta leads yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showLead} onClose={() => { setShowLead(false); setEditLead(null); }} title={editLead ? 'Edit Lead' : 'Add Meta Lead'} size="lg">
        <div className="space-y-4">
          {validationError && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{validationError}</div>}
          <div className="grid gap-3 sm:grid-cols-2"><input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Patient name" value={leadForm.patientName} onChange={e => setLeadForm({ ...leadForm, patientName: e.target.value })} /><input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Phone" value={leadForm.phone || ''} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Email" value={leadForm.email || ''} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} /><select className="premium-input rounded-lg px-3 py-2 text-sm" value={leadForm.status} onChange={e => setLeadForm({ ...leadForm, status: e.target.value })}><option>new</option><option>contacted</option><option>booked</option><option>converted</option><option>lost</option></select></div>
          <div className="grid gap-3 sm:grid-cols-3"><input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Campaign" value={leadForm.campaignName || ''} onChange={e => setLeadForm({ ...leadForm, campaignName: e.target.value })} /><input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Ad name" value={leadForm.adName || ''} onChange={e => setLeadForm({ ...leadForm, adName: e.target.value })} /><input className="premium-input rounded-lg px-3 py-2 text-sm" placeholder="Form name" value={leadForm.formName || ''} onChange={e => setLeadForm({ ...leadForm, formName: e.target.value })} /></div>
          <textarea className="premium-input w-full rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Notes" value={leadForm.notes || ''} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowLead(false)}>Cancel</Button><Button onClick={saveLead}>Save Lead</Button></div>
        </div>
      </Modal>
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Meta Lead" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Delete lead {deleteTarget?.patientName || ''}? This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Keep Lead</Button>
            <Button variant="danger" onClick={removeLead}>Delete Lead</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
