import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Filter, Link as LinkIcon, MessageCircle, Search, Users } from 'lucide-react';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import WhatsAppActionButton, { buildClientMessage } from '../components/outreach/WhatsAppActionButton';
import { MANUAL_WHATSAPP_TEMPLATES } from '../utils/whatsapp';

const today = () => new Date().toISOString().slice(0, 10);

function clientMatchesFilter(client, filter, appointments) {
  if (filter === 'all') return true;
  if (filter === 'inactive') return client.status === 'inactive' || (client.lastVisit && client.lastVisit < today());
  if (filter === 'unpaid') return Number(client.outstandingBalance || 0) > 0;
  if (filter === 'follow_up') return client.nextFollowUpDue && client.nextFollowUpDue <= today();
  if (filter === 'upcoming') {
    return appointments.some(a => (a.clientId || a.client?.id) === client.id && a.date >= today() && !['cancelled', 'completed'].includes(a.status));
  }
  return true;
}

export default function ManualOutreach() {
  const { clinicInfo, term } = useClinic();
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('upcoming');
  const [templateKey, setTemplateKey] = useState('appointment_reminder');
  const [customMessage, setCustomMessage] = useState('');
  const [campaign, setCampaign] = useState('');
  const [link, setLink] = useState('');

  const template = MANUAL_WHATSAPP_TEMPLATES.find(t => t.key === templateKey) || MANUAL_WHATSAPP_TEMPLATES[0];

  const load = async () => {
    setLoading(true);
    try {
      const [c, a, history] = await Promise.all([
        fetchApi('/clients?limit=200').catch(() => ({ clients: [] })),
        fetchApi('/appointments?limit=200&sort=date_asc').catch(() => []),
        fetchApi('/manual-outreach/logs?limit=12').catch(() => ({ logs: [] })),
      ]);
      setClients(Array.isArray(c) ? c : (c.clients || c.data || []));
      setAppointments(Array.isArray(a) ? a : (a.appointments || a.data || []));
      setLogs(Array.isArray(history) ? history : (history.logs || history.data || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter(client => clientMatchesFilter(client, filter, appointments))
      .filter(client => !q || [client.name, client.phone, client.email, client.patientNo].some(v => String(v || '').toLowerCase().includes(q)))
      .map(client => {
        const nextAppointment = appointments
          .filter(a => (a.clientId || a.client?.id) === client.id && a.date >= today() && !['cancelled', 'completed'].includes(a.status))
          .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || ''))[0];
        const message = buildClientMessage({
          clinicName: clinicInfo.name,
          client,
          appointment: nextAppointment,
          template: customMessage.trim() ? { ...template, body: customMessage } : template,
          customContext: { campaign, link },
        });
        return { client, nextAppointment, message };
      });
  }, [appointments, campaign, clients, clinicInfo.name, customMessage, filter, link, search, template]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Starter feature</p>
            <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white">Manual WhatsApp Outreach</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Prepare reminders, follow-ups and campaign messages, then open WhatsApp one by one. Nothing is auto-sent or bulk-sent.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/80 px-4 py-3 dark:bg-white/5"><p className="text-lg font-black">{rows.length}</p><p className="text-[10px] font-bold uppercase text-gray-400">Ready</p></div>
            <div className="rounded-xl bg-white/80 px-4 py-3 dark:bg-white/5"><p className="text-lg font-black">{appointments.filter(a => a.date >= today()).length}</p><p className="text-[10px] font-bold uppercase text-gray-400">Upcoming</p></div>
            <div className="rounded-xl bg-white/80 px-4 py-3 dark:bg-white/5"><p className="text-lg font-black">{logs.length}</p><p className="text-[10px] font-bold uppercase text-gray-400">Recent logs</p></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h2 className="text-sm font-black text-gray-950 dark:text-white">Message composer</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-500">Template</span>
              <select value={templateKey} onChange={e => setTemplateKey(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white">
                {MANUAL_WHATSAPP_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-500"><LinkIcon className="h-3.5 w-3.5" /> Optional campaign link</span>
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-500">Offer/post text</span>
              <input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Special offer or post caption..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-500">Override message</span>
              <textarea rows="5" value={customMessage} onChange={e => setCustomMessage(e.target.value)} placeholder={template.body} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${term('patients', 'patients').toLowerCase()}...`} className="w-56 rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white" />
              </div>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <option value="upcoming">Upcoming appointments</option>
                <option value="follow_up">Follow-up due</option>
                <option value="unpaid">Unpaid balance</option>
                <option value="inactive">Inactive contacts</option>
                <option value="all">All contacts</option>
              </select>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400"><Filter className="h-3.5 w-3.5" /> Manual one-by-one sending list</span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {rows.map(({ client, nextAppointment, message }) => (
              <div key={client.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-gray-950 dark:text-white">{client.name}</p>
                    {client.patientNo && <Badge label={client.patientNo} variant="active" />}
                    {Number(client.outstandingBalance || 0) > 0 && <Badge label="Balance due" variant="pending" />}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{client.phone || 'No phone number'}</p>
                  {nextAppointment && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CalendarClock className="h-3.5 w-3.5" /> {nextAppointment.date} at {nextAppointment.startTime}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-400">{message}</p>
                </div>
                <WhatsAppActionButton
                  client={client}
                  appointment={nextAppointment}
                  message={message}
                  purpose={template.purpose}
                  variant="primary"
                  className="sm:w-auto"
                  onLogged={load}
                >
                  Open WhatsApp
                </WhatsAppActionButton>
              </div>
            ))}
            {!loading && rows.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                <Users className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">No contacts match this filter.</p>
              </div>
            )}
            {loading && <div className="p-12 text-center text-sm text-gray-400">Loading outreach list…</div>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-950 dark:text-white">Recent contact history</h2>
          <MessageCircle className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {logs.map(log => (
            <div key={log.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/5">
              <p className="font-bold text-gray-900 dark:text-white">{log.clientName || 'Contact'}</p>
              <p className="mt-1 text-xs text-gray-500">{log.purpose?.replaceAll('_', ' ') || 'manual'} · {String(log.createdAt || '').slice(0, 16)}</p>
            </div>
          ))}
          {!logs.length && <p className="text-sm text-gray-400">No manual outreach logged yet.</p>}
        </div>
      </section>
    </div>
  );
}
