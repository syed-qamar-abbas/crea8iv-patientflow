import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Edit2, Eye, Loader2, MessageCircle, Plus, Receipt, RefreshCcw, Search, Trash2, Undo2, UserRound, WalletCards } from 'lucide-react';
import { API_URL, fetchApi, peekApiCacheByPrefix } from '../config/api';
import { TableSkeleton, CardGridSkeleton } from '../components/ui/Skeleton';
import { useClinic } from '../context/ClinicContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ClinicLogoMark from '../components/branding/ClinicLogoMark';
import PatientSearchSelect from '../components/ui/PatientSearchSelect';
import { canManageInvoiceAdmin, isReceptionist, canViewBusinessFinancials } from '../config/roles';

const statusVariant = { paid: 'paid', pending: 'pending', partial: 'pending', refunded: 'refunded' };
const money = (value = 0) => `PKR ${Math.round(Number(value || 0)).toLocaleString()}`;
const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const emptyItem = { description: '', qty: 1, unitPrice: 0, serviceId: '' };
const emptyInvoice = {
  clientId: '',
  appointmentId: '',
  items: [emptyItem],
  discountMode: 'amount', // 'amount' (fixed PKR) or 'percentage'
  discount: 0,            // interpreted per discountMode
  amountPaid: 0,
  paymentMethod: 'Cash',
  notes: '',
  dueDate: '',
  procedureCost: '',      // internal clinic cost — NOT shown to the patient
};

const normalizeItems = (items = []) => items.length ? items.map(item => ({
  description: item.description || item.name || '',
  qty: Number(item.qty || 1),
  unitPrice: Number(item.unitPrice || item.price || 0),
  serviceId: item.serviceId || '',
})) : [emptyItem];

const totalsFromForm = (form, selectedClient, editing = false) => {
  const subtotal = form.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0);
  const rawDiscount = Math.max(0, Number(form.discount || 0));
  // Discount can be a fixed PKR amount or a percentage of subtotal. Never exceeds subtotal.
  const discountAmt = form.discountMode === 'percentage'
    ? subtotal * Math.min(100, rawDiscount) / 100
    : Math.min(subtotal, rawDiscount);
  const taxAmt = 0; // Tax removed from invoices.
  const total = subtotal - discountAmt + taxAmt;
  const previousBalance = editing ? Number(form.previousBalance || 0) : Number(selectedClient?.outstandingBalance || 0);
  const grandTotal = total + previousBalance;
  const balanceDue = Math.max(0, grandTotal - Number(form.amountPaid || 0));
  return { subtotal, discountAmt, taxAmt, total, previousBalance, grandTotal, balanceDue };
};

function InvoiceFormModal({ isOpen, onClose, onSave, invoice, prefill, clients, services, appointments, saving, onPatientSelected }) {
  const { term } = useClinic();
  const [form, setForm] = useState(emptyInvoice);
  const [validationError, setValidationError] = useState('');
  const patientLabel = term('patient', 'Patient');
  const appointmentLabel = term('appointment', 'Appointment');
  const serviceLabel = term('service', 'Service');
  const visitLabel = term('visit', 'Visit');

  // Tracks whether the current line items were auto-derived from the linked
  // appointment (vs. typed by the user). Only auto-derived / still-blank items
  // get overwritten when the appointment changes — manual edits are never lost.
  const [itemsAutoFilled, setItemsAutoFilled] = useState(false);

  const prefillKey = [
    prefill?.clientId || '',
    prefill?.appointmentId || '',
    prefill?.clientLabel || '',
  ].join(':');

  const selectedClient = clients.find(client => client.id === form.clientId);
  const selectedAppointment = appointments.find(appt => appt.id === form.appointmentId);
  // Only offer the selected patient's own appointments so you don't scan the
  // whole clinic's list — and can't accidentally link someone else's visit.
  // Most recent first so the newest visit is the natural default.
  const patientAppointments = (form.clientId
    ? appointments.filter(appt => appt.clientId === form.clientId)
    : appointments).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const totals = totalsFromForm(form, selectedClient, Boolean(invoice));
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateItem = (idx, key, value) => { setItemsAutoFilled(false); setForm(current => ({ ...current, items: current.items.map((item, i) => i === idx ? { ...item, [key]: value } : item) })); };
  const addItem = () => { setItemsAutoFilled(false); setForm(current => ({ ...current, items: [...current.items, emptyItem] })); };
  const removeItem = (idx) => { setItemsAutoFilled(false); setForm(current => ({ ...current, items: current.items.filter((_, i) => i !== idx) })); };

  // A single blank starter row (or nothing) is safe to overwrite with appointment data.
  const itemsAreBlank = (items) => !items || items.length === 0 || (items.length === 1 && !items[0]?.description && !Number(items[0]?.unitPrice));
  const itemFromAppt = (appt) => ({
    description: appt?.service?.name || appt?.serviceName || appt?.otherTreatment || '',
    qty: 1,
    unitPrice: Number(appt?.price || 0),
    serviceId: appt?.serviceId || '',
  });

  useEffect(() => {
    setValidationError('');
    setItemsAutoFilled(false);
    if (invoice) {
      setForm({
        clientId: invoice.clientId || '',
        appointmentId: invoice.appointmentId || '',
        items: normalizeItems(invoice.items),
        // The stored discount is an amount — load it directly in amount mode.
        discountMode: 'amount',
        discount: Number(invoice.discount || 0),
        amountPaid: Number(invoice.amountPaid || 0),
        paymentMethod: invoice.paymentMethod || 'Cash',
        notes: invoice.notes || '',
        dueDate: invoice.dueDate || '',
        previousBalance: Number(invoice.previousBalance || 0),
        procedureCost: invoice.procedureCost != null ? String(invoice.procedureCost) : '',
      });
      return;
    }

    const appointment = prefill?.appointmentId
      ? appointments.find(appt => appt.id === prefill.appointmentId)
      : null;
    const item = appointment ? itemFromAppt(appointment) : null;
    const shouldFillItem = item && (item.description || Number(item.unitPrice) > 0);
    const clientId = prefill?.clientId || appointment?.clientId || appointment?.client?.id || '';

    setForm({
      ...emptyInvoice,
      clientId,
      appointmentId: prefill?.appointmentId || '',
      items: shouldFillItem ? [item] : [emptyItem],
    });
    if (shouldFillItem) setItemsAutoFilled(true);
  }, [invoice, isOpen, prefillKey, appointments]);

  // Linking an appointment prefills its treatment + price as a line item, so you
  // don't re-pick the same service by hand. Skips overwrite if you've typed items.
  const chooseAppointment = (apptId) => {
    const appt = appointments.find(a => a.id === apptId);
    const apptItem = appt ? itemFromAppt(appt) : null;
    const willFill = !!(apptItem && (apptItem.description || Number(apptItem.unitPrice) > 0)) && (itemsAutoFilled || itemsAreBlank(form.items));
    setForm(current => ({
      ...current,
      appointmentId: apptId,
      clientId: appt?.clientId || appt?.client?.id || current.clientId,
      items: willFill ? [apptItem] : current.items,
    }));
    if (willFill) setItemsAutoFilled(true);
  };

  const selectService = (idx, serviceId) => {
    setItemsAutoFilled(false);
    const service = services.find(row => row.id === serviceId);
    if (!service) return updateItem(idx, 'description', '');
    setForm(current => ({
      ...current,
      items: current.items.map((item, i) => i === idx ? { ...item, serviceId: service.id, description: service.name, unitPrice: Number(service.price || 0) } : item),
    }));
  };

  const submit = () => {
    setValidationError('');
    if (!form.clientId) return setValidationError(`${patientLabel} is required.`);
    const items = normalizeItems(form.items).filter(item => item.description && item.unitPrice >= 0);
    if (!items.length) return setValidationError('At least one invoice item is required.');
    // Backend expects a discount PERCENTAGE (0-100). Converting the resolved
    // discount amount back to a percentage is exact: subtotal * (amt/subtotal*100)/100 === amt.
    const discountPercent = totals.subtotal > 0 ? (totals.discountAmt / totals.subtotal) * 100 : 0;
    onSave({
      clientId: form.clientId,
      appointmentId: form.appointmentId || null,
      items,
      discount: discountPercent,
      tax: 0, // Tax removed.
      amountPaid: Number(form.amountPaid || 0),
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      dueDate: form.dueDate || null,
      previousBalance: Number(form.previousBalance || 0),
      ...(canViewBusinessFinancials() ? { procedureCost: Number(form.procedureCost || 0) } : {}),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={invoice ? `Edit ${invoice.invoiceNo}` : 'New Invoice'} size="xl">
      <div className="space-y-5">
        {validationError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {validationError}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200" data-training="invoice-patient-field">
            {patientLabel}
            <div className="mt-1">
              <PatientSearchSelect
                value={form.clientId}
                onChange={(id, patient) => {
                  if (patient) onPatientSelected?.(patient);
                  // Auto-link the patient's most recent appointment (new invoices
                  // only) and prefill its treatment, so a typical single-visit bill
                  // needs no extra clicks. Edit mode keeps the saved linkage.
                  const recent = !invoice
                    ? appointments.filter(a => a.clientId === id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
                    : null;
                  const recentItem = recent ? itemFromAppt(recent) : null;
                  const willFill = !!(recentItem && (recentItem.description || Number(recentItem.unitPrice) > 0)) && (itemsAutoFilled || itemsAreBlank(form.items));
                  setForm(current => ({
                    ...current,
                    clientId: id,
                    appointmentId: recent ? recent.id : (invoice ? current.appointmentId : ''),
                    items: willFill ? [recentItem] : current.items,
                  }));
                  if (willFill) setItemsAutoFilled(true);
                }}
                initialLabel={invoice?.client?.name || prefill?.clientLabel || selectedClient?.name || ''}
                fallbackClients={clients}
                inputClassName="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
            </div>
          </label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200" data-training="invoice-appointment-field">
            {appointmentLabel}
            <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.appointmentId} onChange={e => chooseAppointment(e.target.value)}>
              <option value="">No {appointmentLabel.toLowerCase()} link</option>
              {patientAppointments.map(appt => <option key={appt.id} value={appt.id}>{appt.date} · {appt.service?.name || appt.serviceName || serviceLabel}</option>)}
            </select>
            {form.clientId && patientAppointments.length === 0 && (
              <span className="mt-1 block text-[10px] font-medium text-gray-400">No recent {appointmentLabel.toLowerCase()}s for this {patientLabel.toLowerCase()} — leave unlinked for a dues payment.</span>
            )}
          </label>
        </div>

        {selectedClient && (
          <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs sm:grid-cols-4">
            <div><p className="font-bold uppercase text-amber-700">{patientLabel}</p><p className="mt-1 font-black text-gray-900">{selectedClient.patientNo || selectedClient.name}</p></div>
            <div><p className="font-bold uppercase text-amber-700">Current Due</p><p className="mt-1 font-black text-amber-800">{money(selectedClient.outstandingBalance)}</p></div>
            <div><p className="font-bold uppercase text-amber-700">Latest Invoice</p><p className="mt-1 font-black text-gray-900">{selectedClient.latestInvoiceNo || 'None'}</p></div>
            <div><p className="font-bold uppercase text-amber-700">Linked {visitLabel}</p><p className="mt-1 font-black text-gray-900">{selectedAppointment?.date || 'Manual bill'}</p></div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Line Items</label>
            <button onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-[var(--primary)]"><Plus className="h-3.5 w-3.5" /> Add Item</button>
          </div>
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <select className="col-span-5 rounded-lg border border-gray-200 px-2 py-2 text-xs dark:border-white/10 dark:bg-slate-900" value="" onChange={e => selectService(idx, e.target.value)}>
                  <option value="">{item.description || `Select ${serviceLabel.toLowerCase()}...`}</option>
                  {services.map(service => <option key={service.id} value={service.id}>{service.name} · {money(service.price)}</option>)}
                </select>
                <input className="col-span-3 rounded-lg border border-gray-200 px-2 py-2 text-xs dark:border-white/10 dark:bg-slate-900" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description" />
                <input type="number" min="1" className="col-span-1 rounded-lg border border-gray-200 px-2 py-2 text-xs dark:border-white/10 dark:bg-slate-900" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                <input type="number" min="0" className="col-span-2 rounded-lg border border-gray-200 px-2 py-2 text-xs dark:border-white/10 dark:bg-slate-900" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} />
                <button onClick={() => removeItem(idx)} disabled={form.items.length === 1} className="col-span-1 rounded-lg p-2 text-red-400 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Discount Type<select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.discountMode} onChange={e => set('discountMode', e.target.value)}><option value="amount">Amount (PKR)</option><option value="percentage">Percentage (%)</option></select></label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">{form.discountMode === 'percentage' ? 'Discount %' : 'Discount (PKR)'}<input type="number" min="0" step={form.discountMode === 'percentage' ? '1' : '50'} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.discount} onChange={e => set('discount', e.target.value)} placeholder={form.discountMode === 'percentage' ? 'e.g. 10' : 'e.g. 500'} /></label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">{invoice ? 'Total Paid (correction)' : 'Paid Now'}<input type="number" min="0" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.amountPaid} onChange={e => set('amountPaid', e.target.value)} /></label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Method<select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}><option>Cash</option><option>Card</option><option>Bank Transfer</option><option>JazzCash</option><option>EasyPaisa</option></select></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Due Date<input type="date" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.dueDate || ''} onChange={e => set('dueDate', e.target.value)} /></label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">Notes<input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" /></label>
        </div>

        {canViewBusinessFinancials() && (
          <label className="block rounded-lg border border-dashed border-amber-300/60 bg-amber-50/50 p-3 text-xs font-semibold text-gray-700 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-gray-200">
            Internal cost <span className="font-normal text-gray-500">— your cost for this work, for profit tracking. Never shown to the patient or on the invoice.</span>
            <div className="relative mt-1.5 max-w-[220px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">PKR</span>
              <input type="number" min="0" step="any" inputMode="decimal" value={form.procedureCost} onChange={e => set('procedureCost', e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white pl-11 pr-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Cost amount" />
            </div>
          </label>
        )}

        <div className="rounded-xl bg-gray-50 p-4 text-sm dark:bg-white/5">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
          <div className="flex justify-between text-green-600"><span>Discount{form.discountMode === 'percentage' && Number(form.discount) > 0 ? ` (${Number(form.discount)}%)` : ''}</span><span>- {money(totals.discountAmt)}</span></div>
          <div className="flex justify-between text-amber-700"><span>Previous due included</span><span>+ {money(totals.previousBalance)}</span></div>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base font-black text-gray-900 dark:text-white"><span>Grand Total</span><span>{money(totals.grandTotal)}</span></div>
          <div className="flex justify-between text-red-600"><span>Balance Due</span><span>{money(totals.balanceDue)}</span></div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} data-training="invoice-save-button">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{invoice ? 'Save Invoice' : 'Create Invoice'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function RecordPaymentModal({ invoice, onClose, onSave, saving }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [error, setError] = useState('');

  useEffect(() => {
    setAmount(invoice ? String(Number(invoice.balanceDue || 0)) : '');
    setMethod(invoice?.paymentMethod || 'Cash');
    setError('');
  }, [invoice?.id]);

  if (!invoice) return null;
  const balance = Number(invoice.balanceDue || 0);
  const submit = () => {
    const payment = Number(amount || 0);
    if (payment <= 0) return setError('Enter a payment amount greater than zero.');
    if (payment > balance) return setError('Payment cannot exceed the remaining balance.');
    onSave(invoice, payment, method);
  };

  return (
    <Modal isOpen={!!invoice} onClose={onClose} title="Record Payment" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-4 text-sm dark:bg-white/5">
          <div className="flex justify-between gap-3"><span className="text-gray-500">Invoice</span><span className="font-bold text-gray-900 dark:text-white">{invoice.invoiceNo}</span></div>
          <div className="mt-2 flex justify-between gap-3"><span className="text-gray-500">Patient</span><span className="font-bold text-gray-900 dark:text-white">{invoice.client?.name || 'Patient'}</span></div>
          <div className="mt-2 flex justify-between gap-3"><span className="text-gray-500">Remaining balance</span><span className="font-black text-rose-600">{money(balance)}</span></div>
        </div>
        {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
          Amount received now
          <input type="number" min="0.01" max={balance} step="any" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" autoFocus />
        </label>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
          Payment method
          <select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900">
            {['Cash', 'Card', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Other'].map(option => <option key={option}>{option}</option>)}
          </select>
        </label>
        <p className="text-xs leading-5 text-gray-400">This payment will count in the month and day it is received, even when the invoice is older.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}<WalletCards className="h-4 w-4" /> Record Payment</Button>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceDetailModal({ invoice, isOpen, onClose, onMarkPaid, onRefund, onDownload, onPrint, onShareWhatsapp, canAdminInvoice }) {
  const { clinicInfo, term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const [notice, setNotice] = useState('');
  useEffect(() => setNotice(''), [invoice?.id]);
  if (!invoice) return null;
  const invoiceClinic = { ...clinicInfo, ...(invoice.clinic || {}) };
  const sendWhatsapp = () => {
    if (!(invoice.client?.phone || '').replace(/\D/g, '')) setNotice(`No WhatsApp number on file — the PDF will download so you can attach it manually.`);
    onShareWhatsapp?.(invoice);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invoice Detail" size="lg">
      <div className="space-y-6 printable-invoice">
        {notice && (
          <div className="no-print rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {notice}
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <ClinicLogoMark logo={invoiceClinic.logo} alt={`${invoiceClinic.name} logo`} className="mb-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl" textClassName="text-white font-bold text-sm" style={{ background: invoiceClinic.primaryColor || 'var(--primary)' }} />
            <p className="font-bold text-gray-900 dark:text-white">{invoiceClinic.name}</p>
            <p className="text-xs text-gray-500">{invoiceClinic.address}</p>
            <p className="text-xs text-gray-500">{invoiceClinic.phone} · {invoiceClinic.email}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900 dark:text-white">INVOICE</p>
            <p className="mt-1 font-mono text-sm font-bold text-[var(--primary)]">{invoice.invoiceNo}</p>
            <p className="mt-1 text-xs text-gray-500">Date: {String(invoice.createdAt || '').slice(0, 10)}</p>
            <div className="mt-2"><Badge label={invoice.status} variant={statusVariant[invoice.status]} /></div>
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-white/5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Bill To</p>
          <p className="font-semibold text-gray-900 dark:text-white">{invoice.client?.name || `Unknown ${patientLabel.toLowerCase()}`}</p>
          <p className="text-xs text-gray-500">{invoice.client?.phone || 'No phone'}</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 dark:border-white/10"><th className="py-2 text-left text-xs text-gray-500">Description</th><th className="py-2 text-center text-xs text-gray-500">Qty</th><th className="py-2 text-right text-xs text-gray-500">Rate</th><th className="py-2 text-right text-xs text-gray-500">Amount</th></tr></thead>
          <tbody>
            {normalizeItems(invoice.items).map((item, idx) => <tr key={idx} className="border-b border-gray-50 dark:border-white/5"><td className="py-2.5">{item.description}</td><td className="py-2.5 text-center">{item.qty}</td><td className="py-2.5 text-right">{money(item.unitPrice)}</td><td className="py-2.5 text-right font-semibold">{money(item.qty * item.unitPrice)}</td></tr>)}
          </tbody>
        </table>
        <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-white/10">
          <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
          <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>- {money(invoice.discount)}</span></div>
          {Number(invoice.tax) > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Tax</span><span>+ {money(invoice.tax)}</span></div>}
          <div className="flex justify-between text-sm text-amber-700"><span>Previous due</span><span>+ {money(invoice.previousBalance)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-black text-gray-950 dark:text-white"><span>Grand Total</span><span>{money(invoice.grandTotal)}</span></div>
          <div className="flex justify-between text-sm text-green-700"><span>Amount paid</span><span>{money(invoice.amountPaid)}</span></div>
          <div className="flex justify-between text-sm font-bold text-red-600"><span>Balance due</span><span>{money(invoice.balanceDue)}</span></div>
        </div>
        {invoice.notes && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">{invoice.notes}</div>}
        {(() => {
          const payRows = [
            ['Account Title', invoiceClinic.accountTitle],
            ['Bank', invoiceClinic.bankName],
            ['Branch', invoiceClinic.bankBranch],
            ['Account Number', invoiceClinic.accountNumber],
            ['IBAN', invoiceClinic.iban],
          ].filter(([, v]) => v);
          if (!payRows.length && !invoiceClinic.paymentNote) return null;
          return (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">Payment Details</p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {payRows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-right break-all">{value}</span>
                  </div>
                ))}
              </div>
              {invoiceClinic.paymentNote && <p className="mt-2 text-xs text-gray-500">{invoiceClinic.paymentNote}</p>}
            </div>
          );
        })()}
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="secondary" onClick={() => onPrint(invoice)}>Print</Button>
          <Button variant="secondary" onClick={() => onDownload(invoice)}><Download className="h-4 w-4" /> PDF</Button>
          {!['paid', 'refunded', 'cancelled'].includes(invoice.status) && <Button onClick={() => onMarkPaid(invoice)}><WalletCards className="h-4 w-4" /> Record Payment</Button>}
          {canAdminInvoice && invoice.status === 'paid' && <Button variant="secondary" onClick={() => onRefund(invoice)}><Undo2 className="h-4 w-4" /> Refund</Button>}
          <Button variant="secondary" onClick={sendWhatsapp}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceActionConfirmModal({ invoice, action, patientLabel, onClose, onConfirm }) {
  if (!invoice || !action) return null;
  const isRefund = action === 'refund';
  const title = isRefund ? `Refund ${invoice.invoiceNo}` : `Cancel ${invoice.invoiceNo}`;
  const tone = isRefund ? 'amber' : 'red';
  return (
    <Modal isOpen={!!invoice && !!action} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className={`rounded-xl border px-4 py-3 ${
          tone === 'amber'
            ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
            : 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
        }`}>
          <p className="text-sm font-bold">
            {isRefund ? 'Confirm refund' : 'Confirm invoice cancellation'}
          </p>
          <p className="mt-1 text-xs leading-5">
            {isRefund
              ? 'This will mark the paid invoice as refunded and refresh balances.'
              : `This will mark the invoice as Cancelled and keep it on record. ${patientLabel} balances will be recalculated.`}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-xs dark:bg-white/5">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Invoice</span>
            <span className="font-bold text-gray-900 dark:text-white">{invoice.invoiceNo}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-gray-500">{patientLabel}</span>
            <span className="font-bold text-gray-900 dark:text-white">{invoice.client?.name || 'Unknown'}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-gray-500">Grand total</span>
            <span className="font-bold text-gray-900 dark:text-white">{money(invoice.grandTotal)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Keep Invoice</Button>
          <Button variant={isRefund ? 'secondary' : 'danger'} onClick={() => onConfirm(invoice)}>
            {isRefund ? 'Refund Invoice' : 'Cancel Invoice'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Invoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const receptionist = isReceptionist();
  const canSeeAggregateFinancials = canViewBusinessFinancials();
  const canAdminInvoice = canManageInvoiceAdmin();
  const { term } = useClinic();
  const patientLabel = term('patient', 'Patient');
  const [invoices, setInvoices] = useState(() => {
    const c = peekApiCacheByPrefix('/invoices');
    return Array.isArray(c) ? c : (c?.invoices ?? []);
  });
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('date_desc'); // default: newest invoice date first
  const [showForm, setShowForm] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [invoicePrefill, setInvoicePrefill] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmInvoice, setConfirmInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [error, setError] = useState('');
  const page = pagination.page;

  function rememberPatient(patient) {
    if (!patient?.id) return;
    setClients(current => current.some(row => row.id === patient.id) ? current : [patient, ...current]);
  }

  useEffect(() => {
    const statePrefill = location.state?.invoicePrefill || null;
    const params = new URLSearchParams(location.search);
    const queryPrefill = {
      clientId: params.get('clientId') || '',
      appointmentId: params.get('appointmentId') || '',
      clientLabel: params.get('clientName') || '',
      source: 'query',
    };
    const hasQueryPrefill = queryPrefill.clientId || queryPrefill.appointmentId;
    const nextPrefill = statePrefill || (hasQueryPrefill ? queryPrefill : null);
    if (!nextPrefill) return;

    setInvoicePrefill(nextPrefill);
    if (nextPrefill.clientId && nextPrefill.clientLabel) {
      rememberPatient({
        id: nextPrefill.clientId,
        name: nextPrefill.clientLabel,
        phone: nextPrefill.clientPhone || '',
        patientNo: nextPrefill.patientNo || '',
      });
    }
    setEditInvoice(null);
    setShowForm(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  const loadData = async ({ showSpinner = true } = {}) => {
    const params = new URLSearchParams({
      paginated: 'true',
      page: String(page),
      limit: String(pagination.limit),
    });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    if (sort) params.set('sort', sort);

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const to = new Date(today);
    to.setDate(today.getDate() + 60);
    const dateRange = `from=${localDate(from)}&to=${localDate(to)}`;

    if (showSpinner) setLoading(true);
    setError('');
    try {
      const [invoiceRows, clientRows, serviceRows, appointmentRows] = await Promise.all([
        fetchApi(`/invoices?${params.toString()}`),
        fetchApi('/clients?limit=20'),
        fetchApi('/services'),
        fetchApi(`/appointments?${dateRange}&limit=100`),
      ]);
      const rows = Array.isArray(invoiceRows) ? invoiceRows : (invoiceRows.invoices || []);
      setInvoices(rows);
      if (!Array.isArray(invoiceRows)) {
        setPagination(current => ({
          ...current,
          total: Number(invoiceRows.total || 0),
          page: Number(invoiceRows.page || page),
          pages: Number(invoiceRows.pages || 1),
          limit: Number(invoiceRows.limit || current.limit),
        }));
        setServerStats(invoiceRows.stats || null);
      }
      setClients(Array.isArray(clientRows) ? clientRows : (clientRows.clients || []));
      setServices(serviceRows);
      setAppointments(appointmentRows);
    } catch (err) {
      setError(err.message || 'Invoices could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadData(), search.trim() ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, sort, receptionist]);

  const filtered = invoices;

  const stats = useMemo(() => ({
    invoiced: Number(serverStats?.invoiced ?? invoices.reduce((sum, inv) => sum + Number(inv.grandTotal || inv.total || 0), 0)),
    paid: Number(serverStats?.paid ?? invoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0)),
    balance: Number(serverStats?.balance ?? invoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0)),
    patientDues: Number(serverStats?.patientDues ?? clients.reduce((sum, client) => sum + Number(client.outstandingBalance || 0), 0)),
  }), [invoices, clients, serverStats]);

  const goToPage = (nextPage) => {
    setPagination(current => ({ ...current, page: Math.min(Math.max(1, nextPage), current.pages || 1) }));
  };

  const saveInvoice = async (payload) => {
    setSaving(true);
    setError('');
    try {
      if (editInvoice) {
        await fetchApi(`/invoices/${editInvoice.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await fetchApi('/invoices', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      setEditInvoice(null);
      setInvoicePrefill(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Invoice could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const recordPayment = async (invoice, paymentAmount, paymentMethod) => {
    setSaving(true);
    setError('');
    try {
      await fetchApi(`/invoices/${invoice.id}/paid`, { method: 'PUT', body: JSON.stringify({ paymentAmount, paymentMethod }) });
      setPaymentInvoice(null);
      setSelectedInvoice(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Payment could not be recorded.');
    } finally {
      setSaving(false);
    }
  };

  const refundInvoice = async (invoice) => {
    setError('');
    try {
      await fetchApi(`/invoices/${invoice.id}/refund`, { method: 'PUT', body: JSON.stringify({}) });
      setConfirmAction(null);
      setConfirmInvoice(null);
      setSelectedInvoice(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Invoice could not be refunded.');
    }
  };

  const deleteInvoice = async (invoice) => {
    setError('');
    try {
      await fetchApi(`/invoices/${invoice.id}`, { method: 'DELETE' });
      setConfirmAction(null);
      setConfirmInvoice(null);
      await loadData();
    } catch (err) {
      setError(err.message || 'Invoice could not be cancelled.');
    }
  };

  const fetchPdfBlob = async (invoice) => {
    const token = localStorage.getItem('clinic_token');
    // Cache-buster + no-store so the browser never reuses an old cached PDF
    // (e.g. one rendered before the clinic's payment details were added).
    const response = await fetch(`${API_URL}/invoices/${invoice.id}/pdf?t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      let msg = 'PDF could not be generated.';
      try { const j = await response.json(); if (j.error) msg = j.error; } catch (_) { /* non-JSON */ }
      throw new Error(msg);
    }
    return response.blob();
  };
  const fetchPdfBlobUrl = async (invoice) => URL.createObjectURL(await fetchPdfBlob(invoice));

  // WhatsApp share without the Business API: native share sheet with the PDF
  // attached on mobile/tablet, else download the PDF + open the chat on desktop.
  const shareInvoiceWhatsapp = async (invoice) => {
    let phone = (invoice.client?.phone || '').replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.slice(1);
    const msg = `Hi ${invoice.client?.name || patientLabel}, please find your invoice ${invoice.invoiceNo}. Grand total ${money(invoice.grandTotal)}, paid ${money(invoice.amountPaid)}, balance ${money(invoice.balanceDue)}.`;
    let blob;
    try { blob = await fetchPdfBlob(invoice); } catch (e) { setError(e.message); return; }
    const file = new File([blob], `${invoice.invoiceNo || 'invoice'}.pdf`, { type: 'application/pdf' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: invoice.invoiceNo || 'Invoice', text: msg }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const downloadPdf = async (invoice) => {
    try {
      const url = await fetchPdfBlobUrl(invoice);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNo}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err.message || 'PDF could not be downloaded.');
    }
  };

  // Print uses the same server-rendered PDF (clean A4 portrait) instead of
  // window.print() on the modal, which printed the whole app shell.
  const printPdf = async (invoice) => {
    try {
      const url = await fetchPdfBlobUrl(invoice);
      const w = window.open(url, '_blank');
      if (w) { w.addEventListener('load', () => { try { w.print(); } catch (_) {} }); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.message || 'PDF could not be opened.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Invoices & Billing</h1>
          <p className="mt-0.5 text-sm text-gray-500">Live invoices, payments, refunds, PDFs, and {patientLabel.toLowerCase()} balances.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadData}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
          <Button onClick={() => { setEditInvoice(null); setInvoicePrefill(null); setShowForm(true); }} data-training="invoices-new-button"><Plus className="h-4 w-4" /> New Invoice</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {canSeeAggregateFinancials && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            ['Total Invoiced', stats.invoiced],
            ['Paid', stats.paid],
            ['Balance Due', stats.balance],
            [`${patientLabel} Dues`, stats.patientDues],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p><Receipt className="h-4 w-4 text-[var(--primary)]" /></div>
              <p className="text-xl font-black text-gray-900 dark:text-white">{money(value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-slate-900" placeholder={`Search invoice, ${patientLabel.toLowerCase()}, phone...`} value={search} onChange={e => { setSearch(e.target.value); goToPage(1); }} />
        </div>
        <div className="flex gap-1">
          {['all', 'paid', 'partial', 'pending', 'refunded'].map(status => (
            <button key={status} onClick={() => { setStatusFilter(status); goToPage(1); }} className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize ${statusFilter === status ? 'border-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'}`}>{status}</button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => { setSort(e.target.value); goToPage(1); }}
          title="Sort invoices"
          className="rounded-lg border border-gray-200 py-2 px-3 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300"
        >
          <option value="date_desc">Date — newest first</option>
          <option value="date_asc">Date — oldest first</option>
          <option value="amount_desc">Amount — high to low</option>
          <option value="amount_asc">Amount — low to high</option>
          <option value="balance_desc">Balance due — high to low</option>
          <option value="patient_asc">{patientLabel} name — A to Z</option>
          <option value="invoice_desc">Invoice # — newest</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900" data-training="invoice-list">
        {loading && filtered.length === 0 ? (
          <div className="p-2"><TableSkeleton rows={8} cols={9} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center"><Receipt className="mx-auto mb-3 h-10 w-10 text-gray-300" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No invoices found</p><p className="mt-1 text-xs text-gray-400">Create a real invoice. Demo invoice mode has been removed.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/5"><tr>{['Invoice #', 'Date', patientLabel, 'Items', 'Grand Total', 'Paid', 'Balance', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-[var(--primary)]">{inv.invoiceNo}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{String(inv.createdAt || '').slice(0, 10)}</td>
                    <td className="px-4 py-3.5"><p className="text-xs font-semibold text-gray-900 dark:text-white">{inv.client?.name || 'Unknown'}</p><p className="text-[10px] text-gray-500">{inv.client?.phone || ''}</p></td>
                    <td className="max-w-[180px] truncate px-4 py-3.5 text-xs text-gray-600">{normalizeItems(inv.items).map(item => item.description).join(', ')}</td>
                    <td className="px-4 py-3.5 text-xs font-bold text-gray-900 dark:text-white">{money(inv.grandTotal)}</td>
                    <td className="px-4 py-3.5 text-xs text-green-700">{money(inv.amountPaid)}</td>
                    <td className="px-4 py-3.5 text-xs font-bold text-red-600">{money(inv.balanceDue)}</td>
                    <td className="px-4 py-3.5"><Badge label={inv.status} variant={statusVariant[inv.status]} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedInvoice(inv)} className="rounded-lg p-1.5 text-gray-400 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]" title="View"><Eye className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { setEditInvoice(inv); setInvoicePrefill(null); setShowForm(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                        {!['paid', 'refunded', 'cancelled'].includes(inv.status) && <button onClick={() => setPaymentInvoice(inv)} className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600" title="Record payment"><WalletCards className="h-3.5 w-3.5" /></button>}
                        <button onClick={() => downloadPdf(inv)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="PDF"><Download className="h-3.5 w-3.5" /></button>
                        {canAdminInvoice && inv.status !== 'cancelled' && <button onClick={() => { setConfirmInvoice(inv); setConfirmAction('cancel'); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Cancel invoice"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && pagination.total > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {filtered.length} of {pagination.total.toLocaleString()} invoices · Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => goToPage(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}

      <InvoiceFormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditInvoice(null); setInvoicePrefill(null); }} onSave={saveInvoice} invoice={editInvoice} prefill={invoicePrefill} clients={clients} services={services} appointments={appointments} saving={saving} onPatientSelected={rememberPatient} />
      <InvoiceDetailModal invoice={selectedInvoice} isOpen={!!selectedInvoice} onClose={() => setSelectedInvoice(null)} onMarkPaid={setPaymentInvoice} onRefund={(invoice) => { setConfirmInvoice(invoice); setConfirmAction('refund'); }} onDownload={downloadPdf} onPrint={printPdf} onShareWhatsapp={shareInvoiceWhatsapp} canAdminInvoice={canAdminInvoice} />
      <RecordPaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} onSave={recordPayment} saving={saving} />
      <InvoiceActionConfirmModal
        invoice={confirmInvoice}
        action={confirmAction}
        patientLabel={patientLabel}
        onClose={() => { setConfirmInvoice(null); setConfirmAction(null); }}
        onConfirm={confirmAction === 'refund' ? refundInvoice : deleteInvoice}
      />
    </div>
  );
}
