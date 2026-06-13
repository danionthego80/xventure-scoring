'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AnswerOption {
  id?: string;
  label: string;
  text: string;
  is_correct: boolean;
  order_num: number;
}

interface Question {
  id: string;
  theme_id: string;
  order_num: number;
  title: string;
  instruction: string | null;
  points: number;
  media_url: string | null;
  notes: string | null;
  link: string | null;
  mg_answer_options: AnswerOption[];
}

interface Theme {
  id: string;
  name: string;
  description: string | null;
}

interface CsvRow {
  rowNum: number;
  title: string;
  points: number;
  mediaUrl: string;
  notes: string;
  link: string;
  correctAnswer: string;
  options: string[];
  error?: string;
}

const LABELS = ['A', 'B', 'C', 'D', 'E'];

const emptyOptions = (): AnswerOption[] => [
  { label: 'A', text: '', is_correct: false, order_num: 1 },
  { label: 'B', text: '', is_correct: false, order_num: 2 },
  { label: 'C', text: '', is_correct: false, order_num: 3 },
  { label: 'D', text: '', is_correct: false, order_num: 4 },
];

export default function ThemeDetailPage({ params }: { params: { themeId: string } }) {
  const { themeId } = params;
  const [theme, setTheme] = useState<Theme | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'questions' | 'bulk'>('questions');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formInstruction, setFormInstruction] = useState('');
  const [formPoints, setFormPoints] = useState(1);
  const [formMedia, setFormMedia] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formOptions, setFormOptions] = useState<AnswerOption[]>(emptyOptions());
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvParsed, setCsvParsed] = useState(false);
  const [bulkMode, setBulkMode] = useState<'append' | 'replace'>('append');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkDone, setBulkDone] = useState(false)
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);;
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadTheme(); loadQuestions(); }, [themeId]);

    async function handleRenameTheme() {
    if (!nameValue.trim() || nameSaving) return;
    setNameSaving(true);
    const { error } = await supabase
      .from('mg_themes')
      .update({ name: nameValue.trim() })
      .eq('id', themeId);
    if (!error) {
      setTheme((prev: any) => ({ ...prev, name: nameValue.trim() }));
    }
    setEditingName(false);
    setNameSaving(false);
  }

  async function loadTheme() {
    const { data } = await supabase.from('mg_themes').select('*').eq('id', themeId).single();
    if (data) setTheme(data);
  }

  async function loadQuestions() {
    setLoading(true);
    const { data } = await supabase
      .from('mg_questions')
      .select('*, mg_answer_options(id, label, text, is_correct, order_num)')
      .eq('theme_id', themeId)
      .order('order_num');
    if (data) setQuestions(data);
    setLoading(false);
  }

  function startAdd() {
    setEditingId(null); setFormTitle(''); setFormInstruction(''); setFormPoints(1);
    setFormMedia(''); setFormNotes(''); setFormLink(''); setFormOptions(emptyOptions());
    setFormError(''); setShowForm(true);
  }

  function startEdit(q: Question) {
    setEditingId(q.id); setFormTitle(q.title); setFormInstruction(q.instruction || '');
    setFormPoints(q.points); setFormMedia(q.media_url || ''); setFormNotes(q.notes || '');
    setFormLink(q.link || '');
    const opts = [...q.mg_answer_options].sort((a, b) => a.order_num - b.order_num);
    setFormOptions(opts.map((o, i) => ({ ...o, label: LABELS[i] })));
    setFormError(''); setShowForm(true);
  }

  function addOption() {
    if (formOptions.length >= 5) return;
    setFormOptions(prev => [...prev, { label: LABELS[prev.length], text: '', is_correct: false, order_num: prev.length + 1 }]);
  }

  function removeOption(idx: number) {
    if (formOptions.length <= 2) return;
    setFormOptions(prev => prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, label: LABELS[i], order_num: i + 1 })));
  }

  function setCorrect(idx: number) {
    setFormOptions(prev => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
  }

  function updateOptionText(idx: number, text: string) {
    setFormOptions(prev => prev.map((o, i) => i === idx ? { ...o, text } : o));
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    if (formOptions.length < 2) { setFormError('At least 2 answer options required.'); return; }
    if (!formOptions.some(o => o.is_correct)) { setFormError('Please mark one answer as correct.'); return; }
    if (formOptions.some(o => !o.text.trim())) { setFormError('All answer options must have text.'); return; }
    setFormSaving(true); setFormError('');
    const nextOrder = editingId ? questions.find(q => q.id === editingId)?.order_num ?? questions.length + 1 : questions.length + 1;
    if (editingId) {
      await supabase.from('mg_questions').update({ title: formTitle.trim(), instruction: formInstruction.trim() || null, points: formPoints, media_url: formMedia.trim() || null, notes: formNotes.trim() || null, link: formLink.trim() || null }).eq('id', editingId);
      await supabase.from('mg_answer_options').delete().eq('question_id', editingId);
      await supabase.from('mg_answer_options').insert(formOptions.map(o => ({ question_id: editingId, label: o.label, text: o.text.trim(), is_correct: o.is_correct, order_num: o.order_num })));
    } else {
      const { data: qData } = await supabase.from('mg_questions').insert({ theme_id: themeId, order_num: nextOrder, title: formTitle.trim(), instruction: formInstruction.trim() || null, points: formPoints, media_url: formMedia.trim() || null, notes: formNotes.trim() || null, link: formLink.trim() || null }).select().single();
      if (qData) await supabase.from('mg_answer_options').insert(formOptions.map(o => ({ question_id: qData.id, label: o.label, text: o.text.trim(), is_correct: o.is_correct, order_num: o.order_num })));
    }
    setShowForm(false); setFormSaving(false); loadQuestions();
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return;
    await supabase.from('mg_questions').delete().eq('id', id);
    loadQuestions();
  }

  async function moveQuestion(id: string, dir: 'up' | 'down') {
    const idx = questions.findIndex(q => q.id === id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;
    const a = questions[idx]; const b = questions[swapIdx];
    await supabase.from('mg_questions').update({ order_num: b.order_num }).eq('id', a.id);
    await supabase.from('mg_questions').update({ order_num: a.order_num }).eq('id', b.id);
    loadQuestions();
  }

  function parseCsv(text: string): string[][] {
    const rows: string[][] = []; let row: string[] = []; let cell = ''; let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (inQuotes && text[i+1] === '"') { cell += '"'; i++; } else inQuotes = !inQuotes; }
      else if (c === ',' && !inQuotes) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\n') && !inQuotes) {
        if (c === '\n' && text[i+1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(r => r.trim())) rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); if (row.some(r => r.trim())) rows.push(row); }
    return rows;
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processCSV(ev.target?.result as string);
    reader.readAsText(file);
  }

  function processCSV(text: string) {
    const allRows = parseCsv(text);
    if (allRows.length < 2) { setCsvErrors(['File appears empty or invalid.']); return; }
    const header = allRows[0].map(h => h.trim().toLowerCase());
    const qIdx = header.findIndex(h => h === 'question');
    const pointsIdx = header.findIndex(h => h.includes('points'));
    const imgIdx = header.findIndex(h => h.includes('image'));
    const noteIdx = header.findIndex(h => h.includes('note'));
    const linkIdx = header.findIndex(h => h.includes('link'));
    const correctIdx = header.findIndex(h => h.includes('correct answer'));
    if (qIdx === -1 || correctIdx === -1) { setCsvErrors(['Could not find required columns (Question, Correct Answer(s)).']); return; }
    const parsed: CsvRow[] = []; const errors: string[] = [];
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      const title = row[qIdx]?.trim() || ''; if (!title) continue;
      const correctAnswer = row[correctIdx]?.trim() || '';
      const options: string[] = [];
      for (let j = correctIdx + 1; j < row.length; j++) { const opt = row[j]?.trim(); if (opt) options.push(opt); }
      const rowErrors: string[] = [];
      if (!correctAnswer) rowErrors.push('Missing correct answer');
      if (options.length < 1) rowErrors.push('Missing wrong answer options');
      if (options.length > 4) rowErrors.push('Too many wrong answer options (max 4)');
      const cr: CsvRow = { rowNum: i+1, title, points: pointsIdx >= 0 && row[pointsIdx]?.trim() ? Number(row[pointsIdx].trim()) || 1 : 1, mediaUrl: imgIdx >= 0 ? row[imgIdx]?.trim() || '' : '', notes: noteIdx >= 0 ? row[noteIdx]?.trim() || '' : '', link: linkIdx >= 0 ? row[linkIdx]?.trim() || '' : '', correctAnswer, options, error: rowErrors.length > 0 ? rowErrors.join('; ') : undefined };
      parsed.push(cr);
      if (rowErrors.length > 0) errors.push(`Row ${i+1} ("${title.slice(0,30)}"): ${rowErrors.join('; ')}`);
    }
    setCsvRows(parsed); setCsvErrors(errors); setCsvParsed(true); setBulkDone(false);
  }

  const validRows = csvRows.filter(r => !r.error);

  async function handleBulkImport() {
    if (validRows.length === 0) return;
    setBulkImporting(true);
    if (bulkMode === 'replace') {
      const ids = questions.map(q => q.id);
      if (ids.length > 0) await supabase.from('mg_questions').delete().in('id', ids);
    }
    const startOrder = bulkMode === 'replace' ? 1 : questions.length + 1;
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const { data: qData } = await supabase.from('mg_questions').insert({ theme_id: themeId, order_num: startOrder + i, title: row.title, points: row.points || 1, media_url: row.mediaUrl || null, notes: row.notes || null, link: row.link || null }).select().single();
      if (qData) {
                const rawOptions = [
          { question_id: qData.id, text: row.correctAnswer, is_correct: true as boolean },
          ...row.options.slice(0, 4).map((optText) => ({
            question_id: qData.id, text: optText, is_correct: false as boolean
          }))
        ];
        // Shuffle (Fisher-Yates) so correct answer isn't always position A
        for (let k = rawOptions.length - 1; k > 0; k--) {
          const rnd = Math.floor(Math.random() * (k + 1));
          [rawOptions[k], rawOptions[rnd]] = [rawOptions[rnd], rawOptions[k]];
        }
        const answerRows = rawOptions.map((opt, idx) => ({ ...opt, label: LABELS[idx], order_num: idx + 1 }));
        await supabase.from('mg_answer_options').insert(answerRows);
      }
    }
    setBulkImporting(false); setBulkDone(true); setCsvRows([]); setCsvErrors([]); setCsvParsed(false);
    if (fileRef.current) fileRef.current.value = '';
    loadQuestions();
  }
  if (!theme) return <div className="min-h-screen flex items-center justify-center" style={{backgroundColor:'#f0f4f8'}}><p className="text-gray-400">Loading...</p></div>;

  return (
    <div className="min-h-screen" style={{backgroundColor:'#f0f4f8'}}>
      <div className="text-white shadow" style={{backgroundColor:'#0F3460'}}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/admin" className="text-blue-200 hover:text-white text-sm">← Admin</a>
          <span className="text-blue-300">/</span>
          {editingName ? (
            <form onSubmit={e => { e.preventDefault(); handleRenameTheme(); }} className="flex items-center gap-2">
              <input
                autoFocus
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={handleRenameTheme}
                className="text-lg font-bold bg-white/10 border border-white/30 rounded px-2 py-0.5 text-white focus:outline-none focus:ring-2 focus:ring-white/50 min-w-[200px]"
                disabled={nameSaving}
              />
              {nameSaving && <span className="text-sm text-blue-200">Saving…</span>}
            </form>
          ) : (
            <h1
              className="text-lg font-bold cursor-pointer hover:text-blue-200 transition-colors group flex items-center gap-2"
              onClick={() => { setNameValue(theme?.name || ''); setEditingName(true); }}
              title="Click to rename"
            >
              {theme?.name}
              <span className="text-xs text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
            </h1>
          )}
          {theme.description && <span className="text-blue-300 text-sm">— {theme.description}</span>}
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6">
          {(['questions','bulk'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab===tab?'text-white shadow':'bg-white text-gray-600 hover:bg-gray-50'}`}
              style={activeTab===tab?{backgroundColor:'#0F3460'}:{}}>
              {tab==='questions' ? `Questions (${questions.length})` : 'Bulk Upload (Crowdpurr CSV)'}
            </button>
          ))}
        </div>

        {activeTab==='questions' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Question Bank</h2>
              <button onClick={startAdd} className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{backgroundColor:'#0F3460'}}>+ Add Question</button>
            </div>
            {showForm && (
              <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border-2" style={{borderColor:'#0F3460'}}>
                <h3 className="font-bold text-gray-800 mb-4">{editingId?'Edit Question':'New Question'}</h3>
                <form onSubmit={handleSaveQuestion} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Title *</label>
                    <input type="text" value={formTitle} onChange={e=>setFormTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Question title" required autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instruction (optional)</label>
                    <input type="text" value={formInstruction} onChange={e=>setFormInstruction(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Select the correct option" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                      <input type="number" value={formPoints} onChange={e=>setFormPoints(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2" min={1} max={10} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Media URL (optional)</label>
                      <input type="url" value={formMedia} onChange={e=>setFormMedia(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="https://..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Host Notes (optional)</label>
                    <textarea value={formNotes} onChange={e=>setFormNotes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} placeholder="Notes for host only" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Answer Options ({formOptions.length}) — click letter to mark correct ✓</label>
                      {formOptions.length<5 && <button type="button" onClick={addOption} className="text-xs text-blue-600 font-medium">+ Add Option</button>}
                    </div>
                    <div className="space-y-2">
                      {formOptions.map((opt,idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <button type="button" onClick={()=>setCorrect(idx)}
                            className={`w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${opt.is_correct?'bg-green-500 text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {opt.is_correct?'✓':opt.label}
                          </button>
                          <input type="text" value={opt.text} onChange={e=>updateOptionText(idx,e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Option ${opt.label}`} />
                          {formOptions.length>2 && <button type="button" onClick={()=>removeOption(idx)} className="text-red-400 hover:text-red-600 text-xl">×</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                  {formError && <p className="text-red-500 text-sm">{formError}</p>}
                  <div className="flex gap-3">
                    <button type="submit" disabled={formSaving} className="text-white px-5 py-2 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50" style={{backgroundColor:'#0F3460'}}>
                      {formSaving?'Saving...':editingId?'Save Changes':'Add Question'}
                    </button>
                    <button type="button" onClick={()=>setShowForm(false)} className="px-5 py-2 rounded-lg font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                  </div>
                </form>
              </div>
            )}
            {previewQuestion && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">Preview (Team View)</h3>
                    <button onClick={()=>setPreviewQuestion(null)} className="text-gray-400 text-2xl">×</button>
                  </div>
                  <h2 className="text-lg font-bold mb-1">{previewQuestion.title}</h2>
                  {previewQuestion.instruction && <p className="text-gray-500 text-sm mb-4">{previewQuestion.instruction}</p>}
                  <div className="space-y-2 mt-3">
                    {[...previewQuestion.mg_answer_options].sort((a,b)=>a.order_num-b.order_num).map(opt=>(
                      <div key={opt.id} className={`rounded-xl px-4 py-3 border-2 text-sm ${opt.is_correct?'border-green-500 bg-green-50 text-green-800 font-semibold':'border-gray-200 text-gray-700'}`}>
                        <span className="font-bold mr-2">{opt.label}</span>{opt.text}
                        {opt.is_correct && <span className="ml-2 text-green-600 text-xs">(correct)</span>}
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setPreviewQuestion(null)} className="mt-4 w-full text-white rounded-xl py-2 text-sm hover:opacity-90" style={{backgroundColor:'#0F3460'}}>Close</button>
                </div>
              </div>
            )}
            {loading ? <div className="text-center py-12 text-gray-400">Loading questions...</div>
            : questions.length===0 ? (
              <div className="bg-white rounded-xl p-12 text-center"><p className="text-gray-400">No questions yet. Add individually or use Bulk Upload tab.</p></div>
            ) : (
              <div className="space-y-3">
                {questions.map((q,idx) => (
                  <div key={q.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start gap-4">
                    <div className="flex flex-col gap-1 flex-shrink-0 items-center">
                      <button onClick={()=>moveQuestion(q.id,'up')} disabled={idx===0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20">▲</button>
                      <span className="text-xs text-gray-400 font-mono">{idx+1}</span>
                      <button onClick={()=>moveQuestion(q.id,'down')} disabled={idx===questions.length-1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{q.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[...q.mg_answer_options].sort((a,b)=>a.order_num-b.order_num).map(opt=>(
                          <span key={opt.id} className={`text-xs px-2 py-0.5 rounded-full ${opt.is_correct?'bg-green-100 text-green-700 font-semibold':'bg-gray-100 text-gray-500'}`}>
                            {opt.label}: {opt.text.length>28?opt.text.slice(0,28)+'...':opt.text}{opt.is_correct?' ✓':''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={()=>setPreviewQuestion(q)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Preview</button>
                      <button onClick={()=>startEdit(q)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Edit</button>
                      <button onClick={()=>deleteQuestion(q.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab==='bulk' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Bulk Upload from Crowdpurr CSV</h2>
              <p className="text-gray-500 text-sm mb-5">Export from Crowdpurr and upload directly — no reformatting needed.</p>
              <div className="flex gap-6 mb-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={bulkMode==='append'} onChange={()=>setBulkMode('append')} />
                  <span className="text-sm font-medium text-gray-700">Append (add to existing)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={bulkMode==='replace'} onChange={()=>setBulkMode('replace')} />
                  <span className="text-sm font-medium text-red-600">Replace (delete all, import fresh)</span>
                </label>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-gray-600 font-medium">Click to choose CSV file</p>
                  <p className="text-gray-400 text-sm mt-1">Crowdpurr question export format</p>
                </label>
              </div>
              <div className="mt-4 p-4 rounded-xl bg-blue-50 text-sm">
                <p className="font-semibold text-gray-700 mb-1">Expected Crowdpurr CSV columns:</p>
                <p className="text-gray-500 font-mono text-xs">Question | Question Type | Question Points | Question Time | Question Image URL | Question Note | Question Link | Correct Answer(s) | Additional Answer 1 | Additional Answer 2...</p>
              </div>
            </div>
            {csvParsed && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">Parsed {csvRows.length} rows — {validRows.length} valid{csvRows.length-validRows.length>0?', '+(csvRows.length-validRows.length)+' skipped':''}</h3>
                  {csvErrors.length===0 && <span className="text-green-600 text-sm font-semibold">✅ All valid</span>}
                </div>
                {csvErrors.length>0 && (
                  <div className="mb-4 p-4 bg-red-50 rounded-xl">
                    <p className="font-semibold text-red-700 text-sm mb-2">⚠️ {csvErrors.length} row(s) will be skipped:</p>
                    <ul className="space-y-1">{csvErrors.map((e,i)=><li key={i} className="text-red-600 text-xs font-mono">{e}</li>)}</ul>
                  </div>
                )}
                <div className="overflow-x-auto rounded-xl border border-gray-200 mb-5">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">#</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Question</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Correct Answer</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Opts</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Pts</th>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Status</th>
                    </tr></thead>
                    <tbody>
                      {csvRows.map((row,i)=>(
                        <tr key={i} className={row.error?'border-t bg-red-50':'border-t hover:bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{row.rowNum}</td>
                          <td className="px-3 py-2 text-gray-800 max-w-xs">{row.title.length>55?row.title.slice(0,55)+'...':row.title}</td>
                          <td className="px-3 py-2 text-green-700 text-xs">{row.correctAnswer.length>45?row.correctAnswer.slice(0,45)+'...':row.correctAnswer}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{row.options.length}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{row.points}</td>
                          <td className="px-3 py-2">{row.error?<span className="text-red-500 text-xs" title={row.error}>⚠️ Skip</span>:<span className="text-green-600 text-xs">✅ Import</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validRows.length>0&&!bulkDone&&(
                  <div className="flex items-center gap-4">
                    <button onClick={handleBulkImport} disabled={bulkImporting} className="text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50" style={{backgroundColor:'#0F3460'}}>
                      {bulkImporting?'Importing...':'Import '+validRows.length+' Question'+(validRows.length!==1?'s':'')+' ('+(bulkMode==='replace'?'Replace':'Append')+')'}
                    </button>
                    <button onClick={()=>{setCsvParsed(false);setCsvRows([]);setCsvErrors([]);if(fileRef.current)fileRef.current.value='';}} className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Clear</button>
                  </div>
                )}
                {bulkDone&&(
                  <div className="p-4 bg-green-50 rounded-xl text-center">
                    <p className="text-green-700 font-semibold">✅ Import complete!</p>
                    <button onClick={()=>setActiveTab('questions')} className="mt-2 text-green-700 underline text-sm">View questions →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
