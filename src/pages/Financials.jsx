import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BarChart3, DollarSign, Download, FileText, Loader2, Plus,
  Receipt, Save, TrendingDown, TrendingUp, Upload
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { fetchApi, API_URL, peekApiCacheByPrefix } from '../config/api';
import { TableSkeleton, CardGridSkeleton } from '../components/ui/Skeleton';
import { useClinic } from '../context/ClinicContext';

const money = (value = 0) => `PKR ${Number(value || 0).toLocaleString()}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const monthEnd = () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
const fileBase = API_URL.replace(/\/api\/v1\/?$/, '');

function SummaryCard({ label, value, helper, icon: Icon, tone }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900" title={helper}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="text-2xl font-black text-gray-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{helper}</p>
    </div>
  );
}

function EmptyState({ icon: Icon = FileText, title, body }) {
  return (
    <div className="py-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-gray-300" />
      <p className="mt-3 text-sm font-bold text-gray-700 dark:text-gray-200">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{body}</p>
    </div>
  );
}

export default function Financials() {
  const { term } = useClinic();
  const serviceLabel = term('service', 'Service');
  const patientLabel = term('patient', 'Patient');
  const [summary, setSummary] = useState(() => peekApiCacheByPrefix('/financials/summary') ?? null);
  const [monthly, setMonthly] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [profitability, setProfitability] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [procedureRows, setProcedureRows] = useState([]);
  const [range, setRange] = useState({ from: monthStart(), to: monthEnd() });
  const [expenseForm, setExpenseForm] = useState({
    categoryId: '', branchId: '', description: '', amount: '', expenseDate: today(), paymentMethod: 'Cash', receipt: null,
  });
  const [newCategory, setNewCategory] = useState('');
  const [editingCats, setEditingCats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, months, txns, expensePayload, cats, branchRows, profitRows] = await Promise.all([
        fetchApi('/financials/summary'),
        fetchApi('/financials/monthly'),
        fetchApi('/financials/transactions?limit=50'),
        fetchApi(`/expenses?from=${range.from}&to=${range.to}`),
        fetchApi('/expenses/categories'),
        fetchApi('/branches').catch(() => []),
        fetchApi('/financials/profitability').catch(() => []),
      ]);
      setSummary(sum || {});
      setMonthly(Array.isArray(months) ? months : []);
      setTransactions(Array.isArray(txns) ? txns : []);
      setExpenses(Array.isArray(expensePayload?.expenses) ? expensePayload.expenses : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setBranches(Array.isArray(branchRows) ? branchRows : []);
      setProfitability(Array.isArray(profitRows) ? profitRows : []);
      setExpenseForm(current => ({ ...current, categoryId: current.categoryId || cats?.[0]?.id || '' }));
      if (!selectedInvoiceId && Array.isArray(txns) && txns[0]?.id) setSelectedInvoiceId(txns[0].id);
    } catch (err) {
      setError(err.message || 'Financial data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range.from, range.to]);

  useEffect(() => {
    if (!selectedInvoiceId) { setProcedureRows([]); return; }
    fetchApi(`/invoices/${selectedInvoiceId}/procedure-costs`)
      .then(data => setProcedureRows(Array.isArray(data.items) ? data.items : []))
      .catch(() => setProcedureRows([]));
  }, [selectedInvoiceId]);

  const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const topRevenue = useMemo(() => {
    const grouped = {};
    transactions.forEach(txn => (txn.items || []).forEach(item => {
      const name = item.description || item.name || 'Manual item';
      grouped[name] = (grouped[name] || 0) + Number(item.qty || 1) * Number(item.unitPrice || item.price || 0);
    }));
    return Object.entries(grouped).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [transactions]);

  const saveExpense = async () => {
    if (!expenseForm.description.trim()) return setError('Expense description is required.');
    if (Number(expenseForm.amount) <= 0) return setError('Expense amount must be greater than zero.');
    if (!expenseForm.expenseDate) return setError('Expense date is required.');
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(expenseForm).forEach(([key, value]) => {
        if (key === 'receipt') {
          if (value) fd.append('receipt', value);
        } else {
          fd.append(key, value || '');
        }
      });
      await fetchApi('/expenses', { method: 'POST', body: fd });
      setExpenseForm({ categoryId: categories[0]?.id || '', branchId: '', description: '', amount: '', expenseDate: today(), paymentMethod: 'Cash', receipt: null });
      await load();
    } catch (err) {
      setError(err.message || 'Expense could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const renameCategory = async (cat) => {
    const name = window.prompt('Rename category', cat.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === cat.name) return;
    setError('');
    try {
      const updated = await fetchApi(`/expenses/categories/${cat.id}`, { method: 'PUT', body: JSON.stringify({ name: trimmed }) });
      setCategories(current => current.map(c => (c.id === cat.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(err.message || 'Category could not be renamed.');
    }
  };

  const deleteCategory = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"? Existing expenses keep their records.`)) return;
    setError('');
    try {
      await fetchApi(`/expenses/categories/${cat.id}`, { method: 'DELETE' });
      setCategories(current => current.filter(c => c.id !== cat.id));
      setExpenseForm(current => (String(current.categoryId) === String(cat.id) ? { ...current, categoryId: '' } : current));
    } catch (err) {
      setError(err.message || 'Category could not be deleted.');
    }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await fetchApi('/expenses/categories', { method: 'POST', body: JSON.stringify({ name: newCategory.trim() }) });
      setCategories(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setExpenseForm(current => ({ ...current, categoryId: created.id }));
      setNewCategory('');
    } catch (err) {
      setError(err.message || 'Category could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const archiveExpense = async (expense) => {
    if (!window.confirm(`Archive expense "${expense.description}"?`)) return;
    await fetchApi(`/expenses/${expense.id}`, { method: 'DELETE' });
    await load();
  };

  const saveProcedureCost = async (row) => {
    setSaving(true);
    setError('');
    try {
      await fetchApi(`/invoices/${selectedInvoiceId}/procedure-costs`, {
        method: 'PUT',
        body: JSON.stringify({
          invoiceItemIndex: row.invoiceItemIndex,
          patientCharge: Number(row.patientCharge || 0),
          procedureCost: Number(row.procedureCost || 0),
          serviceId: row.serviceId || null,
          notes: row.notes || '',
        }),
      });
      const refreshed = await fetchApi(`/invoices/${selectedInvoiceId}/procedure-costs`);
      setProcedureRows(Array.isArray(refreshed.items) ? refreshed.items : []);
      await load();
    } catch (err) {
      setError(err.message || 'Procedure cost could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !summary) {
    return <div className="space-y-4"><CardGridSkeleton count={4} /><TableSkeleton rows={6} cols={4} /></div>;
  }

  const chartData = monthly.length ? monthly.slice(-8) : [{ month: 'No data', revenue: 0, expenses: 0, grossProfit: 0, netProfit: 0 }];
  const profitableRows = profitability.length ? profitability : [{ procedureName: 'No procedure costs yet', revenue: 0, procedureCost: 0, grossProfit: 0, cases: 0 }];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 dark:text-white">Financials</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Revenue, expenses, procedure costs, and profit reporting for authorized roles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900" title="Report start date" />
          <input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-900" title="Report end date" />
          <Button variant="secondary" size="sm" onClick={load}><Download className="h-4 w-4" /> Refresh</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Revenue" value={money(summary?.totalRevenue)} helper="Paid invoice amount" icon={DollarSign} tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Expenses" value={money(summary?.totalExpenses)} helper="General clinic expenses" icon={TrendingDown} tone="bg-rose-50 text-rose-600" />
        <SummaryCard label="Gross Profit" value={money(summary?.grossProfit)} helper="Revenue minus procedure costs" icon={TrendingUp} tone="bg-blue-50 text-blue-700" />
        <SummaryCard label="Net Profit" value={money(summary?.netProfit)} helper="Gross profit minus expenses" icon={BarChart3} tone="bg-indigo-50 text-indigo-700" />
        <SummaryCard label="Outstanding" value={money(summary?.outstandingPayments)} helper="Pending and partial invoice balance" icon={AlertCircle} tone="bg-amber-50 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 xl:col-span-2">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">Revenue, Expense, and Profit Trend</h2>
          <p className="mt-1 text-xs text-gray-400">Monthly view from invoices, expense entries, and procedure costs.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Number(v || 0) / 1000}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v, name) => [money(v), name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" stroke="#0f766e" fill="#0f766e20" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="#dc2626" fill="#dc262620" strokeWidth={2} />
                <Area type="monotone" dataKey="netProfit" stroke="#4f46e5" fill="#4f46e520" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">Monthly Expense Report</h2>
          <p className="mt-1 text-xs text-gray-400">Selected range total: {money(expenseTotal)}</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Number(v || 0) / 1000}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [money(v), 'Expenses']} />
                <Bar dataKey="expenses" fill="#dc2626" radius={[6, 6, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">Add Expense</h2>
          <p className="mt-1 text-xs text-gray-400">Rent, utility bills, salaries, supplies, and miscellaneous costs.</p>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={expenseForm.categoryId} onChange={e => setExpenseForm({ ...expenseForm, categoryId: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" title="Expense category">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <select value={expenseForm.branchId} onChange={e => setExpenseForm({ ...expenseForm, branchId: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" title="Branch">
                <option value="">All branches</option>
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>
            {categories.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Categories</span>
                  <button type="button" onClick={() => setEditingCats(v => !v)}
                    className="text-[11px] font-bold text-[var(--primary)] hover:underline">
                    {editingCats ? 'Done' : 'Edit'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    editingCats ? (
                      <span key={cat.id} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 py-1 pl-3 pr-1.5 text-xs font-bold text-gray-600 dark:border-white/10 dark:text-gray-300">
                        <button type="button" onClick={() => renameCategory(cat)} title="Rename category" className="hover:text-[var(--primary)]">{cat.name}</button>
                        <button type="button" onClick={() => deleteCategory(cat)} title="Delete category"
                          className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-white/10">×</button>
                      </span>
                    ) : (
                      <button type="button" key={cat.id} onClick={() => setExpenseForm({ ...expenseForm, categoryId: cat.id })}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${String(expenseForm.categoryId) === String(cat.id) ? 'border-transparent bg-[var(--primary)] text-white' : 'border-gray-200 text-gray-500 hover:border-[var(--primary)] hover:text-[var(--primary)] dark:border-white/10 dark:text-gray-400'}`}>
                        {cat.name}
                      </button>
                    )
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input value={newCategory} onChange={e => setNewCategory(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="New category" />
              <Button variant="secondary" size="sm" onClick={addCategory} disabled={saving || !newCategory.trim()}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Description, e.g. electricity bill" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">PKR</span>
                <input type="number" min="0" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full rounded-lg border border-gray-200 pl-11 pr-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" placeholder="Amount" />
              </div>
              <input type="date" value={expenseForm.expenseDate} onChange={e => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" />
              <select value={expenseForm.paymentMethod} onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900">
                {['Cash', 'Card', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Other'].map(method => <option key={method}>{method}</option>)}
              </select>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm font-semibold text-gray-500 hover:border-[var(--primary)] hover:text-[var(--primary)]">
              <Upload className="h-4 w-4" /> {expenseForm.receipt ? expenseForm.receipt.name : 'Attach receipt'}
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setExpenseForm({ ...expenseForm, receipt: e.target.files?.[0] || null })} />
            </label>
            <Button onClick={saveExpense} disabled={saving}><Receipt className="h-4 w-4" /> Save Expense</Button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 xl:col-span-2">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">Expenses</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wider text-gray-400">{['Date', 'Category', 'Description', 'Branch', 'Amount', 'Receipt', ''].map(h => <th key={h} className="py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {expenses.map(expense => (
                  <tr key={expense.id}>
                    <td className="py-3 text-xs text-gray-500">{expense.expenseDate}</td>
                    <td className="py-3"><Badge label={expense.categoryName || 'General'} variant="active" /></td>
                    <td className="py-3 font-semibold text-gray-900 dark:text-white">{expense.description}</td>
                    <td className="py-3 text-xs text-gray-500">{expense.branchName || 'All'}</td>
                    <td className="py-3 font-bold text-rose-600">{money(expense.amount)}</td>
                    <td className="py-3">{expense.receiptUrl ? <a href={expense.receiptUrl.startsWith('http') ? expense.receiptUrl : `${fileBase}${expense.receiptUrl}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-[var(--primary)]">Open</a> : <span className="text-xs text-gray-300">None</span>}</td>
                    <td className="py-3 text-right"><button onClick={() => archiveExpense(expense)} className="text-xs font-bold text-gray-400 hover:text-rose-600">Archive</button></td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={7}><EmptyState icon={Receipt} title="No expenses in this range" body="Add rent, bills, salaries, or supplies to start net profit reporting." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">Procedure Cost Tracking</h2>
          <p className="mt-1 text-xs text-gray-400">Record internal costs per invoice item. Only authorized roles can view this section.</p>
          <select value={selectedInvoiceId} onChange={e => setSelectedInvoiceId(e.target.value)} className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900">
            {transactions.map(txn => <option key={txn.id} value={txn.id}>{txn.invoiceNo} - {txn.client?.name || patientLabel}</option>)}
          </select>
          {procedureRows.length > 0 && (() => {
            const tRev = procedureRows.reduce((s, r) => s + Number(r.patientCharge || 0), 0);
            const tCost = procedureRows.reduce((s, r) => s + Number(r.procedureCost || 0), 0);
            const tProfit = tRev - tCost;
            const tMargin = tRev > 0 ? Math.round((tProfit / tRev) * 100) : 0;
            return (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center dark:bg-white/5">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Revenue</p><p className="mt-0.5 text-sm font-black text-gray-900 dark:text-white">{money(tRev)}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Cost</p><p className="mt-0.5 text-sm font-black text-rose-600">{money(tCost)}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Profit</p><p className={`mt-0.5 text-sm font-black ${tProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(tProfit)} <span className="text-[10px] font-semibold text-gray-400">({tMargin}%)</span></p></div>
              </div>
            );
          })()}
          <div className="mt-4 space-y-3">
            {procedureRows.map((row, index) => {
              const charge = Number(row.patientCharge || 0);
              const cost = Number(row.procedureCost || 0);
              const profit = charge - cost;
              const margin = charge > 0 ? Math.round((profit / charge) * 100) : 0;
              const fieldCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900';
              const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400';
              return (
              <div key={row.invoiceItemIndex} className="rounded-lg border border-gray-100 p-3 dark:border-white/10">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-950 dark:text-white">{row.description}</p>
                    <p className="text-xs"><span className="text-gray-400">Net profit: </span><span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(profit)}</span> <span className="text-gray-400">· {margin}% margin</span></p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => saveProcedureCost(row)} disabled={saving}><Save className="h-4 w-4" /> Save</Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="block"><span className={labelCls}>Patient charge (PKR)</span><input type="number" min="0" value={row.patientCharge} onChange={e => setProcedureRows(rows => rows.map((r, i) => i === index ? { ...r, patientCharge: e.target.value } : r))} className={fieldCls} placeholder="0" /></label>
                  <label className="block"><span className={labelCls}>Internal cost (PKR)</span><input type="number" min="0" value={row.procedureCost} onChange={e => setProcedureRows(rows => rows.map((r, i) => i === index ? { ...r, procedureCost: e.target.value } : r))} className={fieldCls} placeholder="0" /></label>
                  <label className="block"><span className={labelCls}>Cost notes</span><input value={row.notes || ''} onChange={e => setProcedureRows(rows => rows.map((r, i) => i === index ? { ...r, notes: e.target.value } : r))} className={fieldCls} placeholder="e.g. lab + materials" /></label>
                </div>
              </div>
              );
            })}
            {procedureRows.length === 0 && <EmptyState icon={Receipt} title="No invoice selected" body="Create invoices first, then record internal costs here." />}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-gray-950 dark:text-white">Most Profitable Procedures</h2>
          <p className="mt-1 text-xs text-gray-400">Based on recorded procedure costs.</p>
          <div className="mt-4 space-y-3">
            {profitableRows.map(row => (
              <div key={row.procedureName} className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-950 dark:text-white">{row.procedureName}</p>
                    <p className="text-xs text-gray-500">{row.cases} cases - {Number(row.margin || 0)}% margin</p>
                  </div>
                  <p className="text-sm font-black text-teal-700">{money(row.grossProfit)}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-6 text-sm font-bold text-gray-950 dark:text-white">Top Revenue {serviceLabel}s</h2>
          <div className="mt-4 space-y-3">
            {(topRevenue.length ? topRevenue : [{ name: `No paid ${serviceLabel.toLowerCase()}s yet`, revenue: 0 }]).map(row => (
              <div key={row.name} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{row.name}</span>
                <span className="text-xs font-black text-gray-950 dark:text-white">{money(row.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
