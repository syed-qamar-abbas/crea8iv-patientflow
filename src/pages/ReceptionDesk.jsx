import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, Copy, CreditCard, Loader2, MessageCircle, Receipt, Search, Send, WalletCards } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';
import { invoicePrefillFromAppointment, invoicePrefillSearch } from '../utils/invoicePrefill';
import { openWhatsAppMessage } from '../utils/whatsapp';

const money = (value = 0) => `PKR ${Number(value || 0).toLocaleString()}`;

function buildCloseoutMessage({ clinicInfo, today, appointmentLabel, appointmentsLabel, patientLabel, summary, pendingBills, duePatients, note }) {
  const lines = [
    `${clinicInfo.name} - Reception Day Close`,
    `Date: ${today}`,
    '',
    `${appointmentsLabel}: ${summary.totalAppointments}`,
    `Completed: ${summary.completedAppointments}`,
    `Pending/Active: ${summary.pendingAppointments}`,
    `Invoices created: ${summary.invoiceCount}`,
    `Cash received: ${money(summary.cashReceived)}`,
    `Card/Bank received: ${money(summary.cardBankReceived)}`,
    `Total received: ${money(summary.totalReceived)}`,
    `Open invoice balance today: ${money(summary.openBalanceToday)}`,
    '',
    `Bills still to prepare: ${pendingBills.length}`,
  ];

  pendingBills.slice(0, 8).forEach((appointment, index) => {
    lines.push(`${index + 1}. ${(appointment.client?.name || appointment.clientName || patientLabel)} - ${appointment.startTime || ''} - ${appointment.service?.name || appointment.serviceName || appointmentLabel}`);
  });

  lines.push('', `Old dues queue: ${duePatients.length}`);
  duePatients.slice(0, 5).forEach((patient, index) => {
    lines.push(`${index + 1}. ${patient.name} - ${money(patient.outstandingBalance)}`);
  });

  if (note.trim()) {
    lines.push('', `Reception note: ${note.trim()}`);
  }

  return lines.join('\n');
}

function DayCloseModal({ isOpen, onClose, clinicInfo, today, labels, summary, pendingBills, duePatients }) {
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const message = buildCloseoutMessage({
    clinicInfo,
    today,
    appointmentLabel: labels.appointmentLabel,
    appointmentsLabel: labels.appointmentsLabel,
    patientLabel: labels.patientLabel,
    summary,
    pendingBills,
    duePatients,
    note,
  });

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 1800);
    } catch (_) {
      setCopyError('Copy is unavailable in this browser. You can select the summary preview below manually.');
    }
  };

  const sendWhatsApp = async () => {
    const phone = clinicInfo.whatsapp || clinicInfo.phone || '';
    if (!phone) {
      await copySummary();
      setCopyError('No owner WhatsApp number is saved in clinic settings. Summary is ready to copy instead.');
      return;
    }
    openWhatsAppMessage(phone, message);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reception Day Close" size="xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-teal-100 bg-teal-50/80 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black text-gray-950 dark:text-white">{clinicInfo.name}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Closeout for {today}. Review cash, invoices, pending bills, and dues before sending to owner.</p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-right shadow-sm dark:bg-white/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total received</p>
              <p className="text-lg font-black text-teal-700 dark:text-teal-300">{money(summary.totalReceived)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [labels.appointmentsLabel, summary.totalAppointments],
            ['Completed', summary.completedAppointments],
            ['Invoices', summary.invoiceCount],
            ['Open balance', money(summary.openBalanceToday)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-1 text-lg font-black text-gray-950 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h3 className="text-sm font-black text-gray-950 dark:text-white">Payment Breakdown</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Cash</span><span className="font-bold text-gray-950 dark:text-white">{money(summary.cashReceived)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Card / Bank / Wallet</span><span className="font-bold text-gray-950 dark:text-white">{money(summary.cardBankReceived)}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-2 dark:border-white/10"><span className="font-bold text-gray-700 dark:text-gray-200">Total received</span><span className="font-black text-teal-700 dark:text-teal-300">{money(summary.totalReceived)}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h3 className="text-sm font-black text-gray-950 dark:text-white">Bills Still To Prepare</h3>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
              {pendingBills.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/5">
                  <span className="min-w-0 truncate font-bold text-gray-900 dark:text-white">{appointment.client?.name || appointment.clientName || labels.patientLabel}</span>
                  <span className="shrink-0 text-gray-500">{appointment.startTime} - {appointment.service?.name || appointment.serviceName || labels.appointmentLabel}</span>
                </div>
              ))}
              {pendingBills.length === 0 && <p className="py-6 text-center text-sm text-gray-400">All today's billed visits look covered.</p>}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-gray-950 dark:text-white">Old Dues Queue</h3>
            <span className="text-xs font-bold text-rose-600">{money(duePatients.reduce((sum, patient) => sum + Number(patient.outstandingBalance || 0), 0))}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {duePatients.map((patient) => (
              <div key={patient.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/5">
                <span className="min-w-0 truncate font-bold text-gray-900 dark:text-white">{patient.name}</span>
                <span className="shrink-0 font-black text-rose-600">{money(patient.outstandingBalance)}</span>
              </div>
            ))}
            {duePatients.length === 0 && <p className="py-4 text-sm text-gray-400">No old dues in the visible queue.</p>}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Reception note</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="Any cash mismatch, pending follow-up, or owner note..."
          />
        </label>

        <div className="rounded-xl bg-slate-950 p-4 text-xs leading-5 text-white">
          <pre className="max-h-48 whitespace-pre-wrap overflow-y-auto font-mono">{message}</pre>
        </div>
        {copyError && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {copyError}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={copySummary}>
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy Summary'}
          </Button>
          <Button onClick={sendWhatsApp}>
            <Send className="h-4 w-4" /> Send Owner Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeskCard({ icon: Icon, label, value, tone = 'text-gray-950' }) {
  return (
    <div className="luxury-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
        </div>
        <div className="rounded-lg bg-teal-50 p-2 text-teal-700"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

export default function ReceptionDesk() {
  const { term, clinicInfo } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const appointmentLabel = term('appointment', 'Appointment');
  const appointmentsLabel = term('appointments', 'Appointments');
  const treatmentLabel = term('treatment', term('service', 'Service'));
  const doctorLabel = term('doctor', 'Doctor');
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [showDayClose, setShowDayClose] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchApi('/appointments'), fetchApi('/invoices'), fetchApi('/clients')])
      .then(([apptRows, invoiceRows, clientRows]) => {
        setAppointments(Array.isArray(apptRows) ? apptRows : []);
        setInvoices(Array.isArray(invoiceRows) ? invoiceRows : []);
        setClients(Array.isArray(clientRows) ? clientRows : (clientRows.clients || []));
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayAppointments = appointments.filter(appointment => appointment.date === today);
  const filteredAppointments = todayAppointments.filter(appointment => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [appointment.client?.name, appointment.clientName, appointment.service?.name, appointment.serviceName, appointment.staff?.name, appointment.staffName]
      .some(value => String(value || '').toLowerCase().includes(q));
  });
  const todayInvoices = invoices.filter(invoice => String(invoice.createdAt || '').slice(0, 10) === today);
  const cashReceived = todayInvoices.filter(invoice => invoice.status === 'paid' && invoice.paymentMethod === 'Cash').reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0);
  const cardBankReceived = todayInvoices.filter(invoice => ['Card', 'Bank Transfer', 'JazzCash', 'EasyPaisa'].includes(invoice.paymentMethod)).reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0);
  const duePatients = useMemo(() => clients.filter(client => Number(client.outstandingBalance || 0) > 0).slice(0, 5), [clients]);
  const billedAppointmentIds = useMemo(() => new Set(todayInvoices.map(invoice => invoice.appointmentId).filter(Boolean)), [todayInvoices]);
  const pendingBills = useMemo(() => todayAppointments.filter(appointment => {
    if (['cancelled', 'no-show'].includes(appointment.status)) return false;
    return !billedAppointmentIds.has(appointment.id);
  }), [todayAppointments, billedAppointmentIds]);
  const closeoutSummary = useMemo(() => ({
    totalAppointments: todayAppointments.length,
    completedAppointments: todayAppointments.filter(appointment => appointment.status === 'completed').length,
    pendingAppointments: todayAppointments.filter(appointment => !['completed', 'cancelled', 'no-show'].includes(appointment.status)).length,
    invoiceCount: todayInvoices.length,
    cashReceived,
    cardBankReceived,
    totalReceived: cashReceived + cardBankReceived,
    openBalanceToday: todayInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0),
  }), [todayAppointments, todayInvoices, cashReceived, cardBankReceived]);
  const invoiceLinkForAppointment = (appointment) => {
    const invoicePrefill = invoicePrefillFromAppointment(appointment, 'reception');
    const search = invoicePrefillSearch(invoicePrefill);
    return {
      to: { pathname: '/invoices', search: search ? `?${search}` : '' },
      state: { invoicePrefill },
    };
  };

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading reception desk...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 dark:text-white">Reception Desk</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Same-day {appointmentsLabel.toLowerCase()}, invoice preparation, {patientLabel.toLowerCase()} search, and cash handover.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDayClose(true)} data-training="reception-day-close-button"><Send className="h-4 w-4" /> Send Owner Close</Button>
          <Link to="/appointments"><Button size="sm"><CalendarCheck className="h-4 w-4" /> New {appointmentLabel}</Button></Link>
        </div>
      </div>

      <div className="rounded-lg border border-teal-100 bg-teal-50/80 p-4">
        <p className="text-sm font-bold text-teal-950">Restricted Reception View</p>
        <p className="mt-1 text-xs text-teal-700">Reception data is now live. Fake cash drawer, fake queues, and demo collected amount have been removed.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          [`Book ${appointmentLabel}`, `Create and manage live ${appointmentsLabel.toLowerCase()}`, '/appointments'],
          ['Create Invoice', `Prepare ${patientLabel.toLowerCase()} bill from live services`, '/invoices'],
          [`${patientLabel} Search`, `Find ${patientLabel.toLowerCase()} profile and dues`, '/clients'],
          ['WhatsApp', 'Send reminders and confirmations', '/whatsapp'],
        ].map(([label, helper, to]) => (
          <Link key={label} to={to} data-training={label === 'Create Invoice' ? 'reception-quick-invoice' : undefined} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
            <p className="text-sm font-black text-gray-950 dark:text-white">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{helper}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DeskCard icon={CalendarCheck} label={`Today's ${appointmentsLabel}`} value={todayAppointments.length} />
        <DeskCard icon={Receipt} label="Bills To Prepare" value={pendingBills.length} />
        <DeskCard icon={WalletCards} label="Cash Received Today" value={money(cashReceived)} tone="text-teal-700" />
        <DeskCard icon={CreditCard} label="Card/Bank Received" value={money(cardBankReceived)} tone="text-[var(--primary)]" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="luxury-card p-5 xl:col-span-2" data-training="reception-today-schedule">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-950 dark:text-white">Today's Schedule</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Quick check-in, invoice, and WhatsApp actions.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="premium-input w-full rounded-lg py-2 pl-9 pr-3 text-sm sm:w-72" placeholder={`Search ${patientLabel.toLowerCase()}, ${treatmentLabel.toLowerCase()}, ${doctorLabel.toLowerCase()}...`} />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wider text-gray-400">
                  <th className="py-3 font-semibold">Time</th>
                  <th className="py-3 font-semibold">{patientLabel}</th>
                  <th className="py-3 font-semibold">{treatmentLabel}</th>
                  <th className="py-3 font-semibold">{doctorLabel}</th>
                  <th className="py-3 font-semibold">Status</th>
                  <th className="py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAppointments.map(appointment => (
                  <tr key={appointment.id}>
                    <td className="py-3 font-bold text-gray-900">{appointment.startTime}</td>
                    <td className="py-3"><p className="font-semibold text-gray-900">{appointment.client?.name || appointment.clientName || patientLabel}</p></td>
                    <td className="py-3 text-gray-600">{appointment.service?.name || appointment.serviceName || treatmentLabel}</td>
                    <td className="py-3 text-gray-600">{appointment.staff?.name || appointment.staffName || doctorLabel}</td>
                    <td className="py-3"><Badge label={appointment.status} variant={appointment.status} /></td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Link {...invoiceLinkForAppointment(appointment)}>
                          <Button variant="secondary" size="sm">Invoice</Button>
                        </Link>
                        <Link to="/whatsapp"><Button variant="ghost" size="sm"><MessageCircle className="h-4 w-4" /> WhatsApp</Button></Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAppointments.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">No {appointmentsLabel.toLowerCase()} today.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <p className="text-sm font-bold text-amber-950">Reception Safety</p>
                <p className="mt-1 text-xs text-amber-700">Old dues and invoices are calculated from live {patientLabel.toLowerCase()} balances only.</p>
              </div>
            </div>
          </div>

          <div className="luxury-card p-5">
            <h2 className="text-sm font-bold text-gray-950 dark:text-white">Old Dues Queue</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Shown while billing so old balances are not missed.</p>
            <div className="mt-4 space-y-3">
              {duePatients.map(patient => (
                <div key={patient.id} className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-bold text-gray-950 dark:text-white">{patient.name}</p><p className="text-[11px] font-semibold text-teal-700">{patient.patientNo}</p></div>
                    <p className="text-xs font-black text-rose-600">{money(patient.outstandingBalance)}</p>
                  </div>
                </div>
              ))}
              {duePatients.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No outstanding dues.</p>}
            </div>
          </div>

          <div className="luxury-card p-5">
            <h2 className="text-sm font-bold text-gray-950 dark:text-white">Cash Handover</h2>
            <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between"><span className="text-xs text-white/60">Owner handover</span><Clock className="h-4 w-4 text-white/60" /></div>
              <p className="mt-1 text-2xl font-black">{money(cashReceived)}</p>
            </div>
          </div>
        </div>
      </div>
      <DayCloseModal
        isOpen={showDayClose}
        onClose={() => setShowDayClose(false)}
        clinicInfo={clinicInfo}
        today={today}
        labels={{ appointmentLabel, appointmentsLabel, patientLabel }}
        summary={closeoutSummary}
        pendingBills={pendingBills}
        duePatients={duePatients}
      />
    </div>
  );
}
