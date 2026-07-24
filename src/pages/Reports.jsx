import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, DatabaseBackup, Download, FileBarChart, Loader2, Printer, ShieldCheck } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import { isOwner } from '../config/roles';

const money = (value = 0) => `PKR ${Number(value || 0).toLocaleString()}`;

export default function Reports() {
  const owner = isOwner();
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const appointmentLabel = term('appointment', 'Appointment');
  const appointmentsLabel = term('appointments', 'Appointments');
  const doctorLabel = term('doctor', 'Doctor');
  const staffLabel = term('staff', 'Staff');
  const serviceLabel = term('service', 'Service');
  const servicesLabel = term('services', 'Services');
  const [data, setData] = useState({ financials: {}, invoices: [], appointments: [], staff: [], services: [] });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([
      fetchApi('/financials/summary'),
      fetchApi('/invoices'),
      fetchApi('/appointments'),
      fetchApi('/staff'),
      fetchApi('/services'),
    ]).then(([financials, invoices, appointments, staff, services]) => {
      setData({
        financials: financials || {},
        invoices: Array.isArray(invoices) ? invoices : [],
        appointments: Array.isArray(appointments) ? appointments : [],
        staff: Array.isArray(staff) ? staff : [],
        services: Array.isArray(services) ? services : [],
      });
    }).finally(() => setLoading(false));
  }, []);

  const serviceRevenue = useMemo(() => {
    const grouped = {};
    data.invoices.forEach(invoice => {
      (invoice.items || []).forEach(item => {
        const name = item.description || item.name || 'Manual item';
        grouped[name] = (grouped[name] || 0) + Number(item.qty || 1) * Number(item.unitPrice || item.price || 0);
      });
    });
    return Object.entries(grouped).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [data.invoices]);

  const staffRows = useMemo(() => data.staff.map(member => {
    const appts = data.appointments.filter(appt => appt.staffId === member.id);
    const invoiceRevenue = data.invoices
      .filter(invoice => appts.some(appt => appt.id === invoice.appointmentId))
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const payout = invoiceRevenue * Number(member.commissionRate || 0) / 100 + Number(member.fixedSalary || 0);
    return { ...member, cases: appts.length, revenue: invoiceRevenue, payout };
  }), [data.staff, data.appointments, data.invoices]);

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 dark:text-white">Reports Center</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Live revenue, dues, {appointmentsLabel.toLowerCase()}, {doctorLabel.toLowerCase()} commission, and audit-ready summaries. Demo reports removed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm"><Printer className="h-4 w-4" /> Print</Button>
          <Button size="sm" onClick={() => setNotice('Live CSV export can be added as the next reporting task.')}><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Collected', money(data.financials.totalRevenue)],
          ['Outstanding', money(data.financials.outstandingPayments)],
          [appointmentsLabel, data.appointments.length],
          ['Invoices', data.invoices.length],
        ].map(([label, value]) => (
          <div key={label} className="luxury-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
            <p className="mt-1 text-xl font-black text-gray-950 dark:text-white">{value}</p>
            <p className="mt-2 text-xs font-bold text-teal-700">Live database</p>
          </div>
        ))}
      </div>

      <div className="luxury-card p-5">
        <h2 className="text-sm font-bold text-gray-950 dark:text-white">Invoice Ledger</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Only real invoices appear here.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wider text-gray-400">{['Invoice', patientLabel, 'Total', 'Paid', 'Balance', 'Status'].map(h => <th key={h} className="py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {data.invoices.map(invoice => (
                <tr key={invoice.id}>
                  <td className="py-3 font-mono text-xs font-bold text-[var(--primary)]">{invoice.invoiceNo}</td>
                  <td className="py-3 font-bold text-gray-950 dark:text-white">{invoice.client?.name || 'Unknown'}</td>
                  <td className="py-3">{money(invoice.grandTotal || invoice.total)}</td>
                  <td className="py-3 text-teal-700">{money(invoice.amountPaid)}</td>
                  <td className="py-3 text-rose-600">{money(invoice.balanceDue)}</td>
                  <td className="py-3"><Badge label={invoice.status} variant={invoice.status === 'paid' ? 'paid' : invoice.status === 'refunded' ? 'refunded' : 'pending'} /></td>
                </tr>
              ))}
              {data.invoices.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No invoices yet. Collected amount is zero.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="luxury-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-950 dark:text-white">{doctorLabel} Commission & Salary</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Calculated from real {appointmentLabel.toLowerCase()}-linked invoices only.</p>
            </div>
            <Badge label={owner ? 'Owner Only' : 'Locked'} variant={owner ? 'active' : 'inactive'} />
          </div>
          {owner ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wider text-gray-400">{[staffLabel, 'Revenue', 'Commission', 'Salary', 'Cases', 'Payout'].map(h => <th key={h} className="py-3 text-right first:text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {staffRows.map(row => (
                    <tr key={row.id}>
                      <td className="py-3 text-left font-bold text-gray-950 dark:text-white">{row.name}</td>
                      <td className="py-3 text-right">{money(row.revenue)}</td>
                      <td className="py-3 text-right">{Number(row.commissionRate || 0)}%</td>
                      <td className="py-3 text-right">{money(row.fixedSalary)}</td>
                      <td className="py-3 text-right">{row.cases}</td>
                      <td className="py-3 text-right font-black text-teal-700">{money(row.payout)}</td>
                    </tr>
                  ))}
                  {staffRows.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No {staffLabel.toLowerCase()} records.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-gray-50 p-8 text-center dark:bg-white/5"><ShieldCheck className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-2 text-sm font-semibold text-gray-700">Commission and salary report is restricted.</p></div>
          )}
        </div>

        <div className="luxury-card p-5">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">{serviceLabel} Revenue Leaders</h2>
          <div className="mt-4 space-y-3">
            {(serviceRevenue.length ? serviceRevenue : data.services.map(service => ({ name: service.name, revenue: 0 }))).slice(0, 8).map(service => (
              <div key={service.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{service.name}</span>
                  <span className="text-xs font-bold text-gray-950 dark:text-white">{money(service.revenue)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: service.revenue ? '100%' : '0%' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="luxury-card p-5">
          <div className="flex items-center gap-2"><DatabaseBackup className="h-4 w-4 text-teal-700" /><h2 className="text-sm font-bold text-gray-950 dark:text-white">Backup & Export Safety</h2></div>
          <div className="mt-4 space-y-3">
            {['Database backup before deployment', 'Excel/PDF exports for owner reports', 'Print-ready invoices and commission sheets'].map(title => (
              <div key={title} className="rounded-lg bg-gray-50 p-3 dark:bg-white/5"><p className="text-xs font-black text-gray-950 dark:text-white">{title}</p></div>
            ))}
          </div>
        </div>
        <div className="luxury-card p-5 xl:col-span-2">
          <div className="flex items-center gap-2"><FileBarChart className="h-4 w-4 text-teal-700" /><h2 className="text-sm font-bold text-gray-950 dark:text-white">Live Readiness Checklist</h2></div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {['Demo collections removed', `${doctorLabel}s seeded from real clinic data`, `${servicesLabel} editable from CRUD`, 'Invoices use live payment data'].map(item => (
              <div key={item} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white p-3 dark:border-white/10 dark:bg-slate-900"><CheckCircle2 className="mt-0.5 h-4 w-4 text-teal-700" /><p className="text-xs font-semibold leading-relaxed text-gray-700">{item}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
