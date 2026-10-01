import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, UserPlus } from 'lucide-react';
import { fetchApi } from '../../config/api';
import { useClinic } from '../../context/ClinicContext';

// Server-querying patient typeahead — scales to thousands of patients.
// Searches by name, phone, email, or patient number (PT-XXXX) as you type.
//
// Props:
//   value         selected clientId ('' when none)
//   onChange(id, patient)  called with the chosen patient's id (and full row)
//   initialLabel  text to show when a value is preselected (e.g. on edit)
//   fallbackClients  optional already-loaded list to resolve the initial label
//   onAddNew      optional () => void to render a "＋ New patient" action
//   placeholder
export default function PatientSearchSelect({
  value,
  onChange,
  initialLabel = '',
  fallbackClients = [],
  onAddNew,
  placeholder = 'Search by name, phone or patient #…',
  inputClassName = '',
}) {
  const { term } = useClinic();
  const person = term('patient', 'Patient');
  const personLower = person.toLowerCase();
  const defaultPlaceholder = `Search by name, phone or ${personLower} #…`;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // chosen patient {id,name,phone,patientNo}
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  // Resolve the label for a preselected value (edit mode).
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    const fromList = fallbackClients.find((c) => c.id === value);
    if (fromList) { setSelected(fromList); return; }
    if (initialLabel) { setSelected({ id: value, name: initialLabel }); return; }
    // Last resort: fetch the single patient by id.
    fetchApi(`/clients/${value}`, { suppressAuthRedirect: true }).then((c) => c && setSelected(c)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initialLabel]);

  const runSearch = useCallback((q) => {
    if (!q || q.trim().length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    fetchApi(`/clients?search=${encodeURIComponent(q.trim())}&limit=8`, { suppressAuthRedirect: true })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.clients ?? data.data ?? []);
        setResults(list);
        setActive(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounce the query.
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, runSearch]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (c) => {
    setSelected(c);
    onChange(c.id, c);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const clear = () => {
    setSelected(null);
    onChange('', null);
    setQuery('');
    setResults([]);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const base = inputClassName || 'w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';

  // Chosen state: show the patient as a removable chip.
  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{selected.name}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {[selected.patientNo, selected.phone].filter(Boolean).join(' · ') || `Selected ${personLower}`}
          </p>
        </div>
        <button type="button" onClick={clear} title={`Change ${personLower}`} className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-white dark:hover:bg-white/10 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          placeholder={placeholder === 'Search by name, phone or patient #…' ? defaultPlaceholder : placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className={`${base} pl-9`}
        />
        {loading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      {open && (query.trim().length > 0 || onAddNew) && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-xl max-h-72 overflow-y-auto">
          {results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(c)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${i === active ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{c.name}</span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {[c.patientNo, c.phone].filter(Boolean).join(' · ') || c.email || '—'}
                </span>
              </span>
            </button>
          ))}

          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-400">No {term('patients', 'patients').toLowerCase()} match “{query.trim()}”.</div>
          )}

          {onAddNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); onAddNew(query.trim()); }}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-bold text-indigo-600 border-t border-gray-100 dark:border-white/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
            >
              <UserPlus className="w-4 h-4" /> Add new {personLower}{query.trim() ? ` “${query.trim()}”` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
