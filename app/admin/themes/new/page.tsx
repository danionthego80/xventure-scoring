'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NewThemePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');

    const { data, error: err } = await supabase
      .from('mg_themes')
      .insert({ name: name.trim(), description: description.trim() || null })
      .select()
      .single();

    if (err || !data) {
      setError('Failed to create theme. Please try again.');
      setSaving(false);
      return;
    }

    router.push(`/admin/themes/${data.id}`);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="text-white shadow" style={{ backgroundColor: '#0F3460' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/admin" className="text-blue-200 hover:text-white transition-colors text-sm">← Admin</a>
          <span className="text-blue-300">/</span>
          <h1 className="text-lg font-bold">New Theme</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#0F3460' }}>Create Mind Games Theme</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Theme Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Olympics Challenge"
                required
                maxLength={100}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description of this theme"
                rows={3}
                maxLength={500}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="text-white px-6 py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#0F3460' }}
              >
                {saving ? 'Creating...' : 'Create Theme →'}
              </button>
              <a
                href="/admin"
                className="px-6 py-2.5 rounded-lg font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
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
