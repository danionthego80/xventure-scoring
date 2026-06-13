'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'themes' | 'games';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('themes');
  const [themes, setThemes] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'xventure-admin-2026';

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  }

  useEffect(() => {
    if (authenticated) {
      fetchThemes();
      fetchGames();
    }
  }, [authenticated]);

  async function fetchThemes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('mg_themes')
      .select('*, mg_questions(count)')
      .order('name');
    if (!error && data) setThemes(data);
    setLoading(false);
  }

  async function fetchGames() {
    const { data, error } = await supabase
      .from('mg_games')
      .select('*, mg_themes(name)')
      .order('created_at', { ascending: false });
    if (!error && data) setGames(data);
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F3460' }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#0F3460' }}>XVenture Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Mind Games Control Panel</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2"
                style={{ focusRingColor: '#0F3460' } as any}
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            {passwordError && (
              <p className="text-red-500 text-sm">{passwordError}</p>
            )}
            <button
              type="submit"
              className="w-full text-white rounded-lg py-2 font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0F3460' }}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="text-white shadow" style={{ backgroundColor: '#0F3460' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">XVenture Mind Games</h1>
            <p className="text-blue-200 text-sm">Admin Control Panel</p>
          </div>
          <button
            onClick={() => setAuthenticated(false)}
            className="text-blue-200 hover:text-white text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 mt-6">
        <div className="flex gap-2 mb-6">
          {(['themes', 'games'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'text-white shadow'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              style={activeTab === tab ? { backgroundColor: '#0F3460' } : {}}
            >
              {tab === 'themes' ? 'Themes & Questions' : 'Games & Sessions'}
            </button>
          ))}
        </div>

        {/* Themes Tab */}
        {activeTab === 'themes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Mind Games Themes</h2>
              <a
                href="/admin/themes/new"
                className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#0F3460' }}
              >
                + New Theme
              </a>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading themes...</div>
            ) : themes.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <p className="text-gray-400 mb-4">No themes yet.</p>
                <a
                  href="/admin/themes/new"
                  className="text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 inline-block"
                  style={{ backgroundColor: '#0F3460' }}
                >
                  Create Your First Theme
                </a>
              </div>
            ) : (
              <div className="grid gap-4">
                {themes.map(theme => (
                  <div key={theme.id} className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">{theme.name}</h3>
                      {theme.description && (
                        <p className="text-gray-500 text-sm mt-0.5">{theme.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {theme.mg_questions?.[0]?.count ?? 0} questions
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/admin/themes/${theme.id}`}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Manage Questions
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Games Tab */}
        {activeTab === 'games' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Games & Sessions</h2>
              <a
                href="/admin/games/new"
                className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#0F3460' }}
              >
                + Create Game
              </a>
            </div>

            {games.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <p className="text-gray-400">No games yet. Games are auto-created when bookings are confirmed.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {games.map(game => (
                  <div key={game.id} className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{game.title}</h3>
                        <p className="text-gray-500 text-sm mt-0.5">
                          Theme: {(game.mg_themes as any)?.name ?? 'No theme'}
                        </p>
                        {game.scheduled_start && (
                          <p className="text-gray-400 text-xs mt-1">
                            {new Date(game.scheduled_start).toLocaleString('en-AU', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                              timeZone: 'Australia/Sydney'
                            })}
                            {game.scheduled_end && ` – ${new Date(game.scheduled_end).toLocaleString('en-AU', {
                              timeStyle: 'short',
                              timeZone: 'Australia/Sydney'
                            })}`}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        game.status === 'live' ? 'bg-green-100 text-green-700' :
                        game.status === 'finished' ? 'bg-gray-100 text-gray-500' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {game.status}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <a
                        href={`/score/${game.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        View Scoring Link ↗
                      </a>
                      <a
                        href={`/admin/games/${game.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        View Results
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/score/${game.id}`)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
