import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Loader2, Shield } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { fetchApi } from '../config/api';

function DetailsModal({ log, isOpen, onClose }) {
  if (!log) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Audit Log Details" size="lg">
      <div className="space-y-4 text-sm">
        {[
          ['Timestamp', log.createdAt],
          ['User', log.user?.name || log.userId || 'System'],
          ['Action', log.action],
          ['Entity', `${log.entity || '-'} · ${log.entityId || '-'}`],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><p className="mb-1 text-xs text-gray-400">{label}</p><p className="font-semibold text-gray-900 dark:text-white">{value}</p></div>)}
        <div className="rounded-xl bg-[var(--primary)]/10 p-3"><p className="mb-1 text-xs text-gray-400">Details</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-gray-800">{JSON.stringify(log, null, 2)}</pre></div>
      </div>
    </Modal>
  );
}

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (actionFilter !== 'all') query.set('action', actionFilter);
      if (entityFilter !== 'all') query.set('entity', entityFilter);
      const result = await fetchApi(`/audit${query.toString() ? `?${query}` : ''}`);
      setLogs(result.logs || []);
      setTotal(result.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [actionFilter, entityFilter]);

  const entities = useMemo(() => [...new Set(logs.map(log => log.entity).filter(Boolean))], [logs]);
  const counts = {
    CREATE: logs.filter(l => String(l.action).toUpperCase() === 'CREATE').length,
    UPDATE: logs.filter(l => String(l.action).toUpperCase() === 'UPDATE').length,
    DELETE: logs.filter(l => String(l.action).toUpperCase() === 'DELETE').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Audit Trail</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Live log of system actions and changes. Demo audit records removed.</p>
        </div>
        <Button variant="secondary" onClick={() => setNotice('Live audit CSV export can be added next.')}><Download className="h-4 w-4" /> Export</Button>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['all', 'Total', total],
          ['CREATE', 'Created', counts.CREATE],
          ['UPDATE', 'Updated', counts.UPDATE],
          ['DELETE', 'Deleted', counts.DELETE],
        ].map(([action, label, count]) => (
          <button key={action} onClick={() => setActionFilter(action)} className={`rounded-xl p-4 text-left transition-all ${actionFilter === action ? 'bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/40' : 'bg-white shadow-sm dark:bg-slate-900'}`}>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{count}</p>
            <p className="mt-0.5 text-xs text-gray-500">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <select className="premium-input rounded-lg px-3 py-2 text-xs" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="all">All Actions</option><option value="create">Create</option><option value="update">Update</option><option value="delete">Delete</option><option value="login">Login</option>
        </select>
        <select className="premium-input rounded-lg px-3 py-2 text-xs" value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
          <option value="all">All Entities</option>{entities.map(entity => <option key={entity}>{entity}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading audit logs...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5"><tr>{['Timestamp', 'User', 'Action', 'Entity', 'Details'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {logs.map(log => <tr key={log.id}><td className="px-4 py-3.5 font-mono text-xs text-gray-600">{log.createdAt}</td><td className="px-4 py-3.5 text-xs font-semibold">{log.user?.name || 'System'}</td><td className="px-4 py-3.5"><Badge label={log.action} variant={String(log.action).toLowerCase() === 'delete' ? 'cancelled' : 'active'} /></td><td className="px-4 py-3.5 text-xs">{log.entity}</td><td className="px-4 py-3.5"><button onClick={() => setSelectedLog(log)} className="flex items-center gap-1 text-xs font-bold text-[var(--primary)]"><Eye className="h-3.5 w-3.5" /> Details</button></td></tr>)}
              {logs.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400"><Shield className="mx-auto mb-2 h-8 w-8 text-gray-300" />No live audit logs yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <DetailsModal log={selectedLog} isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
