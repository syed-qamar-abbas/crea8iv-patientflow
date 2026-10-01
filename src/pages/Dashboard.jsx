import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Archive, ArrowRight, Bot, Building2, Calendar, Clock, Database, DollarSign, Facebook, FileBarChart, FlaskConical, Image, LifeBuoy, Megaphone, MessageCircle, MessageSquare, Package, Receipt, Settings, Shield, Stethoscope, Target, TrendingDown, TrendingUp, Users, UserCheck, WalletCards } from 'lucide-react';
import { fetchApi, peekApiCache, peekApiCacheByPrefix } from '../config/api';
import { CardGridSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { useClinic } from '../context/ClinicContext';
import StatCard from '../components/ui/StatCard';
import SetupAlert from '../components/dashboard/SetupAlert';
import RevenueChart from '../components/charts/RevenueChart';
import ServiceChart from '../components/charts/ServiceChart';
import Badge from '../components/ui/Badge';
import { canAccessPath, canViewBusinessFinancials, getCurrentRole } from '../config/roles';

const money = (value = 0) => `PKR ${Number(value || 0).toLocaleString()}`;
const localDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};
const RANGE_OPTIONS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 Days', days: 6 },
  { key: '30d', label: '30 Days', days: 29 },
  { key: '3m', label: '3 Months', months: 3 },
  { key: '6m', label: '6 Months', months: 6 },
  { key: '1y', label: '1 Year', months: 12 },
];

const dashboardFinancialRange = (rangeKey = '3m') => {
  const now = new Date();
  const option = RANGE_OPTIONS.find(item => item.key === rangeKey) || RANGE_OPTIONS[3];
  let fromDate = new Date(now);
  if (typeof option.days === 'number') {
    fromDate.setDate(fromDate.getDate() - option.days);
  } else {
    fromDate = addMonths(now, -option.months);
  }
  const from = localDate(fromDate);
  const to = localDate(now);
  return { from, to };
};
const rangeLabel = (rangeKey) => RANGE_OPTIONS.find(item => item.key === rangeKey)?.label || '3 Months';
const dashboardFinancialEndpoint = (rangeKey) => {
  const { from, to } = dashboardFinancialRange(rangeKey);
  return `/financials/summary?from=${from}&to=${to}`;
};
const dashboardSummaryEndpoint = (rangeKey) => {
  const { from, to } = dashboardFinancialRange(rangeKey);
  return `/dashboard/summary?from=${from}&to=${to}`;
};

const iconMap = { Archive, Bot, Building2, Calendar, Database, DollarSign, Facebook, FileBarChart, FlaskConical, Image, LifeBuoy, Megaphone, MessageCircle, MessageSquare, Package, Receipt, Settings, Shield, Stethoscope, Users, UserCheck, WalletCards };

const portalModules = [
  { key: 'reception', to: '/reception' },
  { key: 'clinical', to: '/clinical' },
  { key: 'clients', to: '/clients' },
  { key: 'appointments', to: '/appointments' },
  { key: 'invoices', to: '/invoices' },
  { key: 'staff', to: '/staff' },
  { key: 'services', to: '/services' },
  { key: 'branches', to: '/branches' },
  { key: 'packages', to: '/packages' },
  { key: 'whatsapp', to: '/whatsapp' },
  { key: 'ai', to: '/ai' },
  { key: 'metaLeads', to: '/meta-leads' },
  { key: 'imports', to: '/imports' },
  { key: 'reports', to: '/reports' },
  { key: 'gallery', to: '/gallery' },
  { key: 'audit', to: '/audit' },
  { key: 'settings', to: '/settings' },
];

function DashboardMoneyCard({ title, value, helper, icon: Icon, tone }) {
  const tones = {
    teal: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300',
  };

  return (
    <div className="luxury-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">{title}</p>
          <p className="mt-3 text-2xl font-black text-gray-950 dark:text-white">{money(value)}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{helper}</p>
        </div>
        <div className={`rounded-xl p-2 ${tones[tone] || tones.teal}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { industryTemplate, term } = useClinic();
  const canSeeFinancials = canViewBusinessFinancials();
  const role = getCurrentRole();
  const [rangeKey, setRangeKey] = useState('3m');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [postingRecurringId, setPostingRecurringId] = useState('');
  // Seed from cached lists so returning to the dashboard renders instantly.
  const [data, setData] = useState(() => {
    const asArr = (v, key) => Array.isArray(v) ? v : (v?.[key] ?? []);
    const cachedClients = peekApiCacheByPrefix('/clients');
    const cachedSummary = peekApiCache(dashboardSummaryEndpoint(rangeKey));
    return {
      range: cachedSummary?.range ?? dashboardFinancialRange(rangeKey),
      appointments: cachedSummary?.appointments?.today ?? asArr(peekApiCacheByPrefix('/appointments')),
      todayAppointmentCount: cachedSummary?.appointments?.todayCount ?? null,
      clients: asArr(cachedClients, 'clients'),
      clientsTotal: cachedSummary?.clients?.activeCount ?? cachedClients?.total ?? null,
      clientStageCounts: cachedSummary?.clients?.stageCounts ?? cachedClients?.stageCounts ?? null,
      staff: cachedSummary?.staff?.top ?? asArr(peekApiCacheByPrefix('/staff')),
      staffActiveCount: cachedSummary?.staff?.activeCount ?? null,
      services: asArr(peekApiCacheByPrefix('/services')),
      servicesCount: cachedSummary?.services?.count ?? null,
      invoices: asArr(peekApiCacheByPrefix('/invoices'), 'invoices'),
      pendingInvoiceCount: cachedSummary?.invoices?.pendingCount ?? null,
      pendingInvoices: cachedSummary?.invoices?.pending ?? [],
      financials: cachedSummary?.financials ?? peekApiCache(dashboardFinancialEndpoint(rangeKey)) ?? null,
      doctorPerformance: cachedSummary?.doctorPerformance ?? [],
      expenseReminders: cachedSummary?.expenseReminders ?? [],
    };
  });
  const [loading, setLoading] = useState(true);
  const hasSeed = data.appointments.length > 0 || data.invoices.length > 0 || data.clients.length > 0 || data.clientsTotal !== null;

  useEffect(() => {
    let cancelled = false;

    const setFromLists = ([appointments, clients, staff, services, invoices, financials]) => {
      if (cancelled) return;
      setData({
        appointments: Array.isArray(appointments) ? appointments : [],
        range: dashboardFinancialRange(rangeKey),
        todayAppointmentCount: null,
        clients: Array.isArray(clients) ? clients : (clients.clients || []),
        clientsTotal: Array.isArray(clients) ? clients.length : (clients.total ?? null),
        clientStageCounts: Array.isArray(clients) ? null : (clients.stageCounts ?? null),
        staff: Array.isArray(staff) ? staff : [],
        staffActiveCount: null,
        services: Array.isArray(services) ? services : [],
        servicesCount: null,
        invoices: Array.isArray(invoices) ? invoices : [],
        pendingInvoiceCount: null,
        pendingInvoices: Array.isArray(invoices) ? invoices.filter(inv => inv.status === 'pending' || inv.status === 'partial').slice(0, 6) : [],
        financials: financials || {},
        doctorPerformance: [],
        expenseReminders: [],
      });
    };

    fetchApi(dashboardSummaryEndpoint(rangeKey))
      .then(summary => {
        if (cancelled) return;
        setData({
          range: summary?.range ?? dashboardFinancialRange(rangeKey),
          appointments: summary?.appointments?.today ?? [],
          todayAppointmentCount: summary?.appointments?.todayCount ?? null,
          clients: [],
          clientsTotal: summary?.clients?.activeCount ?? null,
          clientStageCounts: summary?.clients?.stageCounts ?? null,
          staff: summary?.staff?.top ?? [],
          staffActiveCount: summary?.staff?.activeCount ?? null,
          services: [],
          servicesCount: summary?.services?.count ?? null,
          invoices: [],
          pendingInvoiceCount: summary?.invoices?.pendingCount ?? null,
          pendingInvoices: summary?.invoices?.pending ?? [],
          financials: summary?.financials || {},
          doctorPerformance: summary?.doctorPerformance ?? [],
          expenseReminders: summary?.expenseReminders ?? [],
        });
      })
      .catch(() => Promise.all([
        fetchApi('/appointments').catch(() => []),
        fetchApi('/clients').catch(() => ({ clients: [] })),
        fetchApi('/staff').catch(() => []),
        fetchApi('/services').catch(() => []),
        fetchApi('/invoices').catch(() => []),
        canSeeFinancials ? fetchApi(dashboardFinancialEndpoint(rangeKey)).catch(() => ({})) : Promise.resolve({}),
      ]).then(setFromLists))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [canSeeFinancials, rangeKey, refreshNonce]);

  const postRecurringExpense = async (item) => {
    if (!item?.id) return;
    setPostingRecurringId(item.id);
    try {
      await fetchApi(`/expenses/recurring/${item.id}/post`, { method: 'POST', body: JSON.stringify({}) });
      setRefreshNonce(value => value + 1);
    } catch (err) {
      // Keep dashboard calm; the Financials page shows full expense errors.
    } finally {
      setPostingRecurringId('');
    }
  };

  const today = localDate(new Date());
  const todayAppts = data.appointments.filter(appt => appt.date === today);
  const activeStaff = data.staff.filter(member => member.status === 'active');
  const pendingInvoices = data.invoices.filter(inv => inv.status === 'pending' || inv.status === 'partial');
  const topStaff = useMemo(() => activeStaff.slice().sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 5), [activeStaff]);
  const doctorPerformance = data.doctorPerformance?.length ? data.doctorPerformance : topStaff.map(member => ({ ...member, revenue: member.revenue || 0, payable: 0, appointments: member.appointmentsHandled || 0 }));
  const pendingPaymentRows = data.pendingInvoices?.length ? data.pendingInvoices : pendingInvoices.slice(0, 6);
  const selectedRangeLabel = rangeLabel(rangeKey);
  const financials = data.financials || {};
  const forecast = data.range || {};
  const goal = industryTemplate.config.primaryGoal || { label: `Book ${term('appointment', 'Appointment')}` };
  const workflowStages = industryTemplate.config.workflow?.stages || [];
  // /clients returns one page (default 50), so counting the array under-reports
  // any clinic with more patients than that. Prefer the server-side totals.
  const activeClientCount = data.clientsTotal ?? data.clients.filter(c => c.status !== 'inactive').length;
  const todayAppointmentCount = data.todayAppointmentCount ?? todayAppts.length;
  const activeStaffCount = data.staffActiveCount ?? activeStaff.length;
  const pendingInvoiceCount = data.pendingInvoiceCount ?? pendingInvoices.length;
  const servicesCount = data.servicesCount ?? data.services.length;
  const pipelineCounts = useMemo(() => {
    const stageCounts = data.clientStageCounts;
    if (stageCounts) {
      // Unstaged patients (NULL stage, keyed '') fall into the first stage.
      const unstaged = stageCounts[''] ?? 0;
      return workflowStages.map((stage, i) => ({
        stage,
        count: (stageCounts[stage] ?? 0) + (i === 0 ? unstaged : 0),
      }));
    }
    return workflowStages.map(stage => ({
      stage,
      count: data.clients.filter(client => (client.workflowStage || workflowStages[0]) === stage).length,
    }));
  }, [data.clients, data.clientStageCounts, workflowStages.join('|')]);

  if (loading && !hasSeed) {
    return <div className="space-y-4"><CardGridSkeleton count={4} /><TableSkeleton rows={6} cols={4} /></div>;
  }

  return (
    <div className="space-y-6">
      <SetupAlert />
      <div className="overflow-hidden rounded-2xl bg-slate-950 px-5 py-5 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-2.5"><Target className="h-5 w-5 text-[var(--primary)]" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{industryTemplate.name}</p>
              <h1 className="mt-1 text-xl font-black">{goal.label}</h1>
              <p className="mt-1 text-xs text-white/55">Your dashboard, records and schedule follow this niche workflow.</p>
            </div>
          </div>
          <Link to="/appointments" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110">
            {industryTemplate.config.dashboard.primaryAction || goal.label}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {industryTemplate.config.capabilities?.pipeline && (
          <div className="mt-5 flex gap-2 overflow-x-auto border-t border-white/10 pt-4">
            {pipelineCounts.map(({ stage, count }) => (
              <div key={stage} className="min-w-28 rounded-xl bg-white/[0.07] px-3 py-2">
                <p className="text-[10px] font-semibold capitalize text-white/50">{stage.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-lg font-black">{count}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {canSeeFinancials && (
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRangeKey(option.key)}
              className={`rounded-lg px-3 py-2 text-xs font-black transition ${rangeKey === option.key ? 'bg-teal-700 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:border-teal-200 hover:text-teal-700 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={industryTemplate.config.dashboard.todayAppointments} value={String(todayAppointmentCount)} icon={Calendar} />
        {canSeeFinancials
          ? <StatCard title={`Collected ${selectedRangeLabel}`} value={money(financials?.totalRevenue)} icon={Receipt} />
          : <StatCard title="Pending Invoices" value={String(pendingInvoiceCount)} icon={Receipt} />}
        <StatCard title={industryTemplate.config.dashboard.activePatients} value={String(activeClientCount)} icon={Users} />
        <StatCard title={industryTemplate.config.dashboard.activeStaff} value={String(activeStaffCount)} icon={UserCheck} />
      </div>

      {canSeeFinancials && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <DashboardMoneyCard title="Expenses" value={financials.totalExpenses} helper={`${selectedRangeLabel} clinic + procedure costs`} icon={TrendingDown} tone="rose" />
          <DashboardMoneyCard title="Net Profit" value={financials.profit} helper="Collected minus expenses" icon={TrendingUp} tone="teal" />
          <DashboardMoneyCard title="Pending Payments" value={financials.outstandingPayments} helper={`${pendingInvoiceCount} unpaid or partial invoices`} icon={AlertCircle} tone="amber" />
          <DashboardMoneyCard title="Forecast" value={forecast.projectedRevenue} helper={`${money(forecast.dailyAverage)} daily average`} icon={Clock} tone="sky" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="luxury-card h-72 p-5 lg:col-span-2">
          {canSeeFinancials ? (
            <RevenueChart from={data.range?.from} to={data.range?.to} />
          ) : (
            <div className="flex h-full flex-col justify-center text-center">
              <Receipt className="mx-auto h-9 w-9 text-gray-300" />
              <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">Reception Work Queue</h3>
              <p className="mt-1 text-xs text-gray-500">Financial analytics are restricted. Use invoices for billing and payment collection.</p>
            </div>
          )}
        </div>
        <div className="luxury-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{industryTemplate.config.dashboard.scheduleTitle}</h3>
            <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">{todayAppts.length} {term('appointments', 'appointments').toLowerCase()}</span>
          </div>
          <div className="max-h-52 space-y-2.5 overflow-y-auto pr-0.5">
            {todayAppts.map(appt => (
              <div key={appt.id} className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-gray-50/80 dark:hover:bg-white/5">
                <div className="w-14 shrink-0 text-xs font-bold text-gray-900">{appt.startTime}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-800">{appt.client?.name || appt.clientName || term('patient', 'Patient')}</p>
                  <p className="truncate text-[11px] text-gray-500">{appt.service?.name || appt.serviceName || term('treatment', 'Treatment')}</p>
                </div>
                <Badge label={appt.status} variant={appt.status} />
              </div>
            ))}
            {todayAppts.length === 0 && <p className="py-12 text-center text-sm text-gray-400">No {term('appointments', 'appointments').toLowerCase()} today.</p>}
          </div>
        </div>
      </div>

      {canSeeFinancials && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="luxury-card p-5 xl:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-950 dark:text-white">Monthly Expense Checks</h3>
                <p className="mt-1 text-xs text-gray-500">Recurring costs that may still need this month’s entry.</p>
              </div>
              <Link to="/financials" className="shrink-0 text-xs font-bold text-teal-700">Add expense</Link>
            </div>
            <div className="mt-4 space-y-3">
              {(data.expenseReminders || []).map(item => (
                <div key={item.id || `${item.categoryId || item.categoryName}-${item.lastExpenseDate}`} className="rounded-lg border border-amber-100 bg-amber-50/70 p-3 dark:border-amber-400/20 dark:bg-amber-400/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-black text-gray-950 dark:text-white">{item.categoryName}</p>
                        {item.isRecordedThisMonth ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">Recorded</span> : null}
                        {item.isDue ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">Due</span> : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-gray-500">{item.description || 'Monthly expense'}{item.dueDate ? ` · ${item.dueDate}` : ''}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <b className="block text-xs text-amber-700">{money(item.estimatedAmount)}</b>
                      {item.source === 'recurring' && !item.isRecordedThisMonth && (
                        <button
                          type="button"
                          onClick={() => postRecurringExpense(item)}
                          disabled={postingRecurringId === item.id}
                          className="mt-1 rounded-md bg-white px-2 py-1 text-[10px] font-black text-amber-800 shadow-sm disabled:opacity-50 dark:bg-slate-950"
                        >
                          {postingRecurringId === item.id ? 'Posting' : 'Post'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!data.expenseReminders || data.expenseReminders.length === 0) && (
                <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">No recurring expense reminders for this month.</p>
              )}
            </div>
          </div>

          <div className="luxury-card p-5 xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-950 dark:text-white">Pending Payment Queue</h3>
                <p className="mt-1 text-xs text-gray-500">Invoices to follow up before they become old dues.</p>
              </div>
              <Link to="/invoices" className="shrink-0 text-xs font-bold text-teal-700">Open invoices</Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {pendingPaymentRows.map(invoice => (
                <div key={invoice.id} className="rounded-lg border border-gray-100 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-gray-950 dark:text-white">{invoice.clientName || term('patient', 'Patient')}</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">{invoice.invoiceNo || 'Invoice'} · {invoice.status}</p>
                    </div>
                    <b className="shrink-0 text-xs text-rose-600">{money(invoice.balanceDue)}</b>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">{invoice.dueDate ? `Due ${invoice.dueDate}` : 'No due date'}{invoice.ageDays ? ` · ${invoice.ageDays} days` : ''}</p>
                </div>
              ))}
              {pendingPaymentRows.length === 0 && <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">No pending invoices right now.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="luxury-card h-64 p-5"><ServiceChart /></div>
        <div className="luxury-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">{canSeeFinancials ? 'Top Doctor Earnings' : industryTemplate.config.dashboard.topStaff}</h3>
          <div className="space-y-3">
            {doctorPerformance.map(member => (
              <div key={member.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{member.name}</p>
                  <p className="text-[11px] text-gray-500">{canSeeFinancials ? `${member.appointments || 0} appointments` : (member.designation || member.role)}</p>
                </div>
                {canSeeFinancials ? (
                  <div className="text-right">
                    <p className="text-xs font-black text-teal-700">{money(member.revenue)}</p>
                    <p className="text-[11px] text-gray-400">Pay {money(member.payable)}</p>
                  </div>
                ) : <span className="text-xs font-bold text-amber-600">★ {Number(member.rating || 0).toFixed(1)}</span>}
              </div>
            ))}
            {doctorPerformance.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No staff configured.</p>}
          </div>
        </div>
        <div className="luxury-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Billing Snapshot</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Pending invoices</span><b>{pendingInvoiceCount}</b></div>
            {canSeeFinancials
              ? <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><b>{money(data.financials?.outstandingPayments)}</b></div>
              : <div className="flex justify-between"><span className="text-gray-500">Invoices needing payment</span><b>{pendingInvoiceCount}</b></div>}
            <div className="flex justify-between"><span className="text-gray-500">{industryTemplate.config.dashboard.servicesConfigured}</span><b>{servicesCount}</b></div>
          </div>
        </div>
      </div>

      <div className="luxury-card p-5">
        <h2 className="text-sm font-bold text-gray-950 dark:text-white">{industryTemplate.config.dashboard.portalFeatures}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">All modules below are live entry points. CRUD-enabled modules update the database directly.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {portalModules.filter(({ key, to }) => (
            canAccessPath(to, role) && industryTemplate.config.modules?.[key]?.visible !== false
          )).map(({ key, to }) => {
            const mod = industryTemplate.templateKey === 'healthcare'
              ? (industryTemplate.config.dashboardModules?.[key] || industryTemplate.config.modules?.[key] || {})
              : (industryTemplate.config.modules?.[key] || industryTemplate.config.dashboardModules?.[key] || {});
            const Icon = iconMap[mod.icon] || Settings;
            return (
            <Link key={to} to={to} className="group rounded-lg border border-gray-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-teal-50 p-2 text-teal-700 transition-colors group-hover:bg-teal-700 group-hover:text-white"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-gray-950 dark:text-white">{mod.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{mod.desc}</p>
                </div>
              </div>
            </Link>
          );})}
        </div>
      </div>
    </div>
  );
}
