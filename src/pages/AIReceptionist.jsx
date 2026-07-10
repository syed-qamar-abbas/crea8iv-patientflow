import { useEffect, useMemo, useState } from 'react';
import {
  Bot, Loader2, Check, ChevronRight, ChevronLeft, Plus, Trash2, Send,
  MessageSquare, BookOpen, Languages, Sparkles, Play, ShieldCheck, Lightbulb, Power,
} from 'lucide-react';
import { fetchApi } from '../config/api';
import { useClinic } from '../context/ClinicContext';

const STEPS = [
  { n: 1, label: 'Tone & Identity', icon: Bot },
  { n: 2, label: 'Language & Style', icon: Languages },
  { n: 3, label: 'Greetings & Rules', icon: MessageSquare },
  { n: 4, label: 'Knowledge Base', icon: BookOpen },
  { n: 5, label: 'Preview Responses', icon: Sparkles },
  { n: 6, label: 'Test in Sandbox', icon: Play },
  { n: 7, label: 'Activate', icon: Power },
];

const titleize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const LANG_LABEL = { english: 'English', roman_urdu: 'Roman Urdu', urdu: 'Urdu', mixed: 'Urdu + English (mixed)' };
const SAMPLE_QUESTIONS = [
  'Assalamualaikum, what are your timings?',
  'How much is teeth whitening?',
  'Do you do braces? I want a consultation.',
  'My tooth is paining a lot, what should I do?',
];

function Tip({ children }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:bg-orange-500/10 dark:text-orange-200">
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{children}</span>
    </div>
  );
}
function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{label}</span>
      {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:focus:ring-orange-500/20';

export default function AIReceptionist() {
  const { clinicInfo, term } = useClinic();
  const patientLabel = term('patient', 'patient');
  const patientsLabel = term('patients', 'patients');
  const appointmentLabel = term('appointment', 'appointment');
  const appointmentsLabel = term('appointments', 'appointments');
  const doctorLabel = term('doctor', 'doctor');
  const serviceLabel = term('service', 'service');
  const treatmentLabel = term('treatment', 'treatment');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [persona, setPersona] = useState(null);
  const [options, setOptions] = useState({ tones: [], languages: [], genders: [], knowledgeCategories: [] });
  const [knowledge, setKnowledge] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // knowledge add form
  const [kForm, setKForm] = useState({ category: 'faq', title: '', content: '' });
  // sandbox
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const set = (patch) => setPersona((p) => ({ ...p, ...patch }));

  const load = async () => {
    setLoading(true);
    try {
      const [p, k] = await Promise.all([
        fetchApi('/ai-receptionist/persona'),
        fetchApi('/ai-receptionist/knowledge'),
      ]);
      setPersona(p.persona);
      setOptions(p.options || {});
      setKnowledge(k.items || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const savePersona = async (extra = {}) => {
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await fetchApi('/ai-receptionist/persona', { method: 'PUT', body: JSON.stringify({ ...persona, ...extra }) });
      setPersona(res.persona);
      setNotice('Saved.');
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setSaving(false); }
  };

  const addKnowledge = async () => {
    if (!kForm.content.trim()) { setError('Add some content for this knowledge entry.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetchApi('/ai-receptionist/knowledge', { method: 'POST', body: JSON.stringify(kForm) });
      setKnowledge((list) => [...list, res.item]);
      setKForm({ category: kForm.category, title: '', content: '' });
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const removeKnowledge = async (id) => {
    try { await fetchApi(`/ai-receptionist/knowledge/${id}`, { method: 'DELETE' }); setKnowledge((l) => l.filter((x) => x.id !== id)); }
    catch (e) { setError(e.message); }
  };

  const sendSandbox = async (msg) => {
    const text = (msg ?? chatInput).trim();
    if (!text) return;
    setChat((c) => [...c, { role: 'user', content: text }]);
    setChatInput(''); setChatBusy(true); setError('');
    try {
      const res = await fetchApi('/ai-receptionist/preview', { method: 'POST', body: JSON.stringify({ message: text, persona }) });
      setChat((c) => [...c, { role: 'ai', content: res.reply }]);
    } catch (e) {
      setChat((c) => [...c, { role: 'error', content: e.message }]);
    } finally { setChatBusy(false); }
  };

  const activate = async () => {
    const ok = await savePersona({ isActive: true });
    if (ok) setNotice('AI Receptionist activated. It will use this persona and knowledge base.');
  };

  const done = useMemo(() => {
    if (!persona) return {};
    return {
      1: !!persona.receptionistName?.trim(),
      2: !!persona.language,
      3: !!(persona.greetingStyle?.trim() || persona.sampleReplies?.trim()),
      4: knowledge.length > 0,
      5: chat.length > 0,
      6: chat.some((m) => m.role === 'ai'),
      7: !!persona.isActive,
    };
  }, [persona, knowledge, chat]);

  if (loading || !persona) {
    return <div className="flex justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading the AI Receptionist Builder…</div>;
  }

  const goNext = async () => {
    if ([1, 2, 3].includes(step)) { const ok = await savePersona(); if (!ok) return; }
    setStep((s) => Math.min(7, s + 1));
  };
  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30"><Bot className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Receptionist Builder</h1>
          <p className="text-sm text-gray-500">Give {clinicInfo?.name || 'your business'} its own WhatsApp receptionist — set its voice, teach it your business, and test it before going live.</p>
        </div>
        <div className="ml-auto">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${persona.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10'}`}>
            {persona.isActive ? '● Active' : '○ Draft'}
          </span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</div>}

      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        {/* Checklist */}
        <aside className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Setup checklist</p>
          <div className="space-y-1">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = step === s.n;
              return (
                <button key={s.n} onClick={() => setStep(s.n)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${active ? 'bg-orange-50 font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5'}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${done[s.n] ? 'bg-emerald-500 text-white' : active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500 dark:bg-white/10'}`}>
                    {done[s.n] ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Step content */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          {step === 1 && (
            <div className="space-y-4">
              <StepHead n={1} title="Tone & identity" sub={`${patientsLabel} should feel they're talking to a real person from your team.`} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Receptionist name" hint="e.g. Sara, Ayesha, Bilal"><input className={inputCls} value={persona.receptionistName} onChange={(e) => set({ receptionistName: e.target.value })} placeholder="Sara" /></Field>
                <Field label="Assistant gender">
                  <select className={inputCls} value={persona.assistantGender} onChange={(e) => set({ assistantGender: e.target.value })}>
                    {options.genders.map((g) => <option key={g} value={g}>{titleize(g)}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Tone" hint="How should the receptionist sound?">
                <div className="flex flex-wrap gap-2">
                  {options.tones.map((t) => (
                    <button key={t} onClick={() => set({ tone: t })}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition-colors ${persona.tone === t ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 text-gray-600 hover:border-orange-300 dark:border-white/10 dark:text-gray-300'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Personality style" hint="Optional — a short phrase, e.g. 'calm and reassuring', 'upbeat and concierge-like'"><input className={inputCls} value={persona.personalityStyle} onChange={(e) => set({ personalityStyle: e.target.value })} placeholder="warm and concierge-like" /></Field>
              <Tip>Each business receptionist should feel unique. A salon, agency, studio, clinic, and consultancy should not sound the same.</Tip>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <StepHead n={2} title="Language & writing style" sub="Most Pakistani businesses do best with Roman Urdu or a natural Urdu + English mix." />
              <Field label="Primary language">
                <div className="flex flex-wrap gap-2">
                  {options.languages.map((l) => (
                    <button key={l} onClick={() => set({ language: l })}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${persona.language === l ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 text-gray-600 hover:border-orange-300 dark:border-white/10 dark:text-gray-300'}`}>{LANG_LABEL[l] || titleize(l)}</button>
                  ))}
                </div>
              </Field>
              <Field label="Writing style" hint="Optional — e.g. 'short messages, friendly emojis, no slang'"><input className={inputCls} value={persona.writingStyle} onChange={(e) => set({ writingStyle: e.target.value })} placeholder="Short, friendly, a few emojis" /></Field>
              <Field label="Brand values" hint="Optional — what your business stands for; the AI will reflect this"><input className={inputCls} value={persona.brandValues} onChange={(e) => set({ brandValues: e.target.value })} placeholder={`Honest advice, on-time ${appointmentsLabel}, clear communication`} /></Field>
              <Tip>The receptionist always replies in your chosen language, but automatically switches if a {patientLabel} writes in a different one.</Tip>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <StepHead n={3} title="Greetings, intro & rules" sub="Teach the AI how to open a chat and the do's and don'ts of your business." />
              <Field label="Greeting style" hint="How the first message should sound">
                <input className={inputCls} value={persona.greetingStyle} onChange={(e) => set({ greetingStyle: e.target.value })} placeholder="Assalamualaikum, thank you for contacting The Smile Xperts 🦷" />
              </Field>
              <Field label="Business introduction" hint="A line or two the AI can use to introduce the business">
                <textarea rows={2} className={inputCls} value={persona.clinicIntro} onChange={(e) => set({ clinicIntro: e.target.value })} placeholder={`We're a modern business offering ${serviceLabel.toLowerCase()}s, ${appointmentsLabel.toLowerCase()}, and helpful follow-up.`} />
              </Field>
              <Field label="Sample replies" hint="Paste a few of your real replies — the AI learns your style from these (one per line)">
                <textarea rows={4} className={inputCls} value={persona.sampleReplies} onChange={(e) => set({ sampleReplies: e.target.value })} placeholder={'Ji bilkul! Whitening ka session 45 minutes ka hota hai.\nAap kis din aana prefer karenge?'} />
              </Field>
              <Field label="Conversation rules" hint="Anything the AI must always / never do for your business">
                <textarea rows={3} className={inputCls} value={persona.conversationRules} onChange={(e) => set({ conversationRules: e.target.value })} placeholder={`Always offer a clear next ${appointmentLabel}.\nNever quote custom pricing without team review.`} />
              </Field>
              <Tip>Operations-only safety is backend enforced: the AI handles appointments and clinic information, but refuses symptom assessment, triage, diagnosis, medication, dosage, and treatment advice.</Tip>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <StepHead n={4} title="Knowledge base" sub={`The AI answers ONLY from what you add here — so it never invents prices, ${doctorLabel}s or hours.`} />
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <Field label="Category">
                    <select className={inputCls} value={kForm.category} onChange={(e) => setKForm((f) => ({ ...f, category: e.target.value }))}>
                      {options.knowledgeCategories.map((c) => <option key={c} value={c}>{titleize(c)}</option>)}
                    </select>
                  </Field>
                  <Field label="Title" hint="Optional short label"><input className={inputCls} value={kForm.title} onChange={(e) => setKForm((f) => ({ ...f, title: e.target.value }))} placeholder="Teeth whitening" /></Field>
                </div>
                <div className="mt-3"><Field label="Content" hint={`The actual facts: prices, hours, ${doctorLabel} bios, policies, FAQs...`}>
                  <textarea rows={3} className={inputCls} value={kForm.content} onChange={(e) => setKForm((f) => ({ ...f, content: e.target.value }))} placeholder={`${treatmentLabel} details, price, duration, availability, and next steps.`} />
                </Field></div>
                <button onClick={addKnowledge} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
                  <Plus className="h-4 w-4" /> Add to knowledge base
                </button>
              </div>

              {knowledge.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
                  <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm font-bold text-gray-600 dark:text-gray-300">No knowledge yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">Add your pricing list, opening hours, team profiles and common FAQs. The more you add, the smarter and safer your receptionist becomes.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledge.map((k) => (
                    <div key={k.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
                      <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">{titleize(k.category)}</span>
                      <div className="min-w-0 flex-1">
                        {k.title && <p className="text-sm font-bold text-gray-900 dark:text-white">{k.title}</p>}
                        <p className="text-xs text-gray-500 line-clamp-2">{k.content}</p>
                      </div>
                      <button onClick={() => removeKnowledge(k.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(step === 5 || step === 6) && (
            <div className="space-y-4">
              <StepHead n={step} title={step === 5 ? 'Preview responses' : 'Test in sandbox'} sub={step === 5 ? 'Tap a sample question to see how your receptionist would reply.' : `Chat exactly like a ${patientLabel} would. Nothing here is sent to anyone.`} />
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5">
                <Play className="h-4 w-4" /> Video walkthrough coming soon — for now, try the examples below.
              </div>
              {step === 5 && (
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button key={q} disabled={chatBusy} onClick={() => sendSandbox(q)} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 dark:border-white/10 dark:text-gray-300">{q}</button>
                  ))}
                </div>
              )}
              <div className="flex h-[320px] flex-col rounded-xl border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/5">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {chat.length === 0 && <p className="py-10 text-center text-xs text-gray-400">No messages yet. {step === 5 ? 'Pick a sample question above.' : 'Type a message below.'}</p>}
                  {chat.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'bg-orange-600 text-white' : m.role === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-white text-gray-800 shadow-sm dark:bg-slate-800 dark:text-gray-100'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatBusy && <div className="flex justify-start"><div className="rounded-2xl bg-white px-3.5 py-2 text-sm text-gray-400 shadow-sm dark:bg-slate-800"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
                </div>
                <div className="flex items-center gap-2 border-t border-gray-200 p-2 dark:border-white/10">
                  <input className={inputCls} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendSandbox()} placeholder={`Type a ${patientLabel} message...`} />
                  <button onClick={() => sendSandbox()} disabled={chatBusy} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"><Send className="h-4 w-4" /></button>
                </div>
              </div>
              <Tip>If you see “AI is not configured”, ask the platform admin to add an AI key in Platform settings — the receptionist needs it to think.</Tip>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <StepHead n={7} title="Activate AI Receptionist" sub="Review the summary, then turn it on." />
              <div className="grid gap-3 sm:grid-cols-2">
                <Summary label="Name" value={persona.receptionistName || '—'} />
                <Summary label="Tone" value={titleize(persona.tone)} />
                <Summary label="Language" value={LANG_LABEL[persona.language] || titleize(persona.language)} />
                <Summary label="Knowledge entries" value={String(knowledge.length)} />
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Safety guardrails are always on: no unsupported advice, no outcome promises, no cross-tenant data, and automatic hand-off to your team when unsure.
              </div>
              <button onClick={activate} disabled={saving} className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${persona.isActive ? 'bg-gray-500' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                <Power className="h-4 w-4" /> {persona.isActive ? 'Re-save & keep active' : 'Activate AI Receptionist'}
              </button>
              {persona.isActive && (
                <button onClick={() => savePersona({ isActive: false })} disabled={saving} className="ml-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300">
                  Turn off
                </button>
              )}
            </div>
          )}

          {/* Wizard nav */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/10">
            <button onClick={goPrev} disabled={step === 1} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-gray-500 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/5"><ChevronLeft className="h-4 w-4" /> Back</button>
            <span className="text-xs text-gray-400">Step {step} of 7{saving ? ' · saving…' : ''}</span>
            {step < 7 ? (
              <button onClick={goNext} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">Next <ChevronRight className="h-4 w-4" /></button>
            ) : <span className="w-16" />}
          </div>
        </section>
      </div>
    </div>
  );
}

function StepHead({ n, title, sub }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600">Step {n} of 7</p>
      <h2 className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{sub}</p>
    </div>
  );
}
function Summary({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
