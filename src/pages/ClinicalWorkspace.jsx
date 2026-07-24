import { useEffect, useMemo, useState } from 'react';
import { Activity, Briefcase, Calendar, CheckCircle2, Loader2, Stethoscope, UserRound } from 'lucide-react';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import Badge from '../components/ui/Badge';

const money = (value) => `PKR ${Number(value || 0).toLocaleString()}`;

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="luxury-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
          <p className="mt-1 text-2xl font-black text-gray-950 dark:text-white">{value}</p>
        </div>
        <div className="rounded-lg bg-teal-50 p-2 text-teal-700"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function TemplatePipelineBoard({ clients, clientsTotal, setClients, template, term }) {
  const stages = template.config.workflow?.stages || ['new', 'active', 'closed'];
  const [movingId, setMovingId] = useState('');
  const [error, setError] = useState('');
  const move = async (client, workflowStage) => {
    setMovingId(client.id);
    setError('');
    try {
      await fetchApi(`/clients/${client.id}`, { method: 'PUT', body: JSON.stringify({ workflowStage }) });
      setClients(current => current.map(item => item.id === client.id ? { ...item, workflowStage } : item));
    } catch (err) {
      setError(`Stage update failed: ${err.message}`);
    } finally {
      setMovingId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">{template.name}</p>
          <h1 className="mt-1 text-xl font-bold text-gray-950 dark:text-white">{term('clinicalWorkspace', 'Workflow Pipeline')}</h1>
          <p className="mt-1 text-sm text-gray-500">Move {term('patients', 'records').toLowerCase()} through the template-defined workflow without changing historical data.</p>
        </div>
        <div className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {clientsTotal ?? clients.length} {term('patients', 'records').toLowerCase()}
        </div>
      </div>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage, index) => {
          const items = clients.filter(client => (client.workflowStage || stages[0]) === stage);
          return (
            <section key={stage} className="w-72 shrink-0 rounded-2xl border border-gray-100 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-xs font-black capitalize text-gray-800 dark:text-white">{stage.replaceAll('_', ' ')}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-gray-500 shadow-sm dark:bg-white/10">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(client => (
                  <article key={client.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
                    <div className="flex items-start gap-2">
                      <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/10"><Briefcase className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-950 dark:text-white">{client.name}</p>
                        <p className="truncate text-[11px] text-gray-500">{client.phone || client.email || 'No contact details'}</p>
                      </div>
                    </div>
                    <select disabled={movingId === client.id} value={stage} onChange={event => move(client, event.target.value)} className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-bold capitalize text-gray-600 dark:border-white/10 dark:bg-slate-950 dark:text-gray-200">
                      {stages.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
                    </select>
                  </article>
                ))}
                {items.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 px-3 py-8 text-center text-xs text-gray-400 dark:border-white/10">No records in this stage</div>}
              </div>
              {index < stages.length - 1 && <p className="mt-3 text-center text-[10px] font-semibold text-gray-300">Next: {stages[index + 1].replaceAll('_', ' ')}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ClinicalWorkspace() {
  const { term, industryTemplate, capability } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const patientsLabel = term('patients', 'Patients');
  const appointmentLabel = term('appointment', 'Appointment');
  const appointmentsLabel = term('appointments', 'Appointments');
  const staffLabel = term('staff', 'Staff');
  const treatmentLabel = term('treatment', 'Treatment');
  const serviceLabel = term('service', 'Service');
  const servicesLabel = term('services', 'Services');
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientsTotal, setClientsTotal] = useState(null);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchApi('/appointments').catch(() => []),
      fetchApi('/clients').catch(() => ({ clients: [] })),
      fetchApi('/staff').catch(() => []),
      fetchApi('/services').catch(() => []),
    ]).then(([appt, clientData, staffData, serviceData]) => {
      setAppointments(Array.isArray(appt) ? appt : []);
      setClients(Array.isArray(clientData) ? clientData : (clientData.clients || []));
      setClientsTotal(Array.isArray(clientData) ? clientData.length : (clientData.total ?? null));
      setStaff(Array.isArray(staffData) ? staffData : []);
      setServices(Array.isArray(serviceData) ? serviceData : []);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const clinical = useMemo(() => {
    const activeAppts = appointments.filter((a) => a.status !== 'cancelled');
    return {
      today: activeAppts.filter((a) => a.date === today).length,
      completed: activeAppts.filter((a) => a.status === 'completed').length,
      // /clients returns one page (default 50) — use the server total so this
      // doesn't plateau at the page size on larger clinics.
      activePatients: clientsTotal ?? clients.filter((c) => c.status === 'active').length,
      activeStaff: staff.filter((s) => s.status === 'active').length,
      plannedRevenue: activeAppts.reduce((sum, a) => sum + Number(a.price || 0), 0),
    };
  }, [appointments, clients, clientsTotal, staff, today]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;

  if (capability('pipeline')) {
    return <TemplatePipelineBoard clients={clients} clientsTotal={clientsTotal} setClients={setClients} template={industryTemplate} term={term} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <strong>Operations workspace:</strong> workload and appointment history only. PatientFlow is not currently an EHR and must not be used as the authoritative clinical record.
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 dark:text-white">Operations Workspace</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Operational workload, {appointmentsLabel.toLowerCase()}, {staffLabel.toLowerCase()} capacity and {serviceLabel.toLowerCase()} coverage.</p>
          {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`${appointmentsLabel} Today`} value={clinical.today} icon={Calendar} />
        <Stat label={`Active ${patientsLabel}`} value={clinical.activePatients} icon={UserRound} />
        <Stat label={staffLabel} value={clinical.activeStaff} icon={Stethoscope} />
        <Stat label="Completed Cases" value={clinical.completed} icon={CheckCircle2} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="luxury-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-950 dark:text-white">{treatmentLabel} {appointmentsLabel}</h2>
              <p className="text-xs text-gray-500">Real {appointmentsLabel.toLowerCase()} from the portal database.</p>
            </div>
            <Badge label={money(clinical.plannedRevenue)} variant="active" />
          </div>
          <div className="mt-4 space-y-2">
            {appointments.slice(0, 12).map((appt) => (
              <div key={appt.id} className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-gray-950 dark:text-white">{appt.client?.name || patientLabel}</p>
                    <p className="text-xs text-gray-500">{appt.service?.name || treatmentLabel} · {appt.staff?.name || staffLabel} · {appt.date} {appt.startTime}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {appt.status && <Badge label={appt.status} variant={appt.status} />}
                    <span className="text-xs font-black text-gray-950 dark:text-white">{money(appt.price)}</span>
                  </div>
                </div>
              </div>
            ))}
            {appointments.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No {appointmentsLabel.toLowerCase()} yet. Add {patientsLabel.toLowerCase()}, {staffLabel.toLowerCase()} and {servicesLabel.toLowerCase()}, then book the first {appointmentLabel.toLowerCase()}.</p>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="luxury-card p-5">
            <h2 className="text-sm font-bold text-gray-950 dark:text-white">{staffLabel}</h2>
            <div className="mt-4 space-y-2">
              {staff.slice(0, 8).map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-white/5">
                  <div>
                    <p className="text-xs font-black text-gray-950 dark:text-white">{member.name}</p>
                    <p className="text-[11px] text-gray-500">{member.role} · {member.specialty || 'general'}</p>
                  </div>
                  {member.status && <Badge label={member.status} variant={member.status} />}
                </div>
              ))}
              {staff.length === 0 && <p className="text-sm text-gray-400">No {staffLabel.toLowerCase()} added yet.</p>}
            </div>
          </div>

          <div className="luxury-card p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-bold text-gray-950 dark:text-white">{serviceLabel} Coverage</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {services.slice(0, 16).map((service) => (
                <span key={service.id} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{service.name}</span>
              ))}
              {services.length === 0 && <p className="text-sm text-gray-400">No {servicesLabel.toLowerCase()} added yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
