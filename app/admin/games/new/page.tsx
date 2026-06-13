'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Theme {
  id: string;
  name: string;
}

export default function NewGamePage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [title, setTitle] = useState('');
  const [themeId, setThemeId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [pointsPerQuestion, setPointsPerQuestion] = useState(10);
  const [penaltyMode, setPenaltyMode] = useState('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('mg_themes').select('id, name').order('name').then(({ data }) => {
      if (data) setThemes(data);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    const { data, error: err } = await supabase
      .from('mg_games')
      .insert({
        title: title.trim(),
        theme_id: themeId || null,
        scheduled_start: scheduledStart || null,
        scheduled_end: scheduledEnd || null,
        points_per_question: pointsPerQuestion,
        penalty_mode: penaltyMode,
        status: 'draft',
      })
      .select('id')
      .single();
    if (err) { setError(err.message); setSaving(false); return; }
    window.location.href = `/admin/games/${data.id}`;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="text-white px-6 py-4" style={{ backgroundColor: '#0F3460' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <a href="/admin" className="text-blue-200 hover:text-white text-sm">← Admin</a>
          <span className="text-blue-300">/</span>
          <h1 className="text-lg font-bold">Create New Game</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <form onSubmit={handleCreate} className="space-y-6">

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Game Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Olympics Challenge — Friday 7pm"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
              <select
                value={themeId}
                onChange={e => setThemeId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No theme selected —</option>
                {themes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Scheduled Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Start</label>
              <input
                type="datetime-local"
                value={scheduledStart}
                onChange={e => setScheduledStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Scheduled End */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled End</label>
              <input
                type="datetime-local"
                value={scheduledEnd}
                onChange={e => setScheduledEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Points Per Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points per Question</label>
              <input
                type="number"
                min={1}
                max={100}
                value={pointsPerQuestion}
                onChange={e => setPointsPerQuestion(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Penalty Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Penalty Mode</label>
              <select
                value={penaltyMode}
                onChange={e => setPenaltyMode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No penalty</option>
                <option value="half">Half points deducted for wrong answer</option>
                <option value="full">Full points deducted for wrong answer</option>
              </select>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 text-white py-3 rounded-xl font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#0F3460' }}
              >
                {saving ? 'Creating…' : 'Create Game'}
              </button>
              <a
                href="/admin"
                className="px-6 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition-colors text-center"
              >
                Cancel
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
