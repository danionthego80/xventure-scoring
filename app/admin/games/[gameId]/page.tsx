'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type GameStatus = 'draft' | 'live' | 'finished';

interface Game {
  id: string;
  title: string;
  status: GameStatus;
  theme_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  points_per_question: number;
  penalty_mode: string;
  mg_themes: { name: string } | null;
}

interface Team {
  id: string;
  name: string;
  company: string | null;
  captain_name: string | null;
  total_score: number;
  correct_count: number;
}

const STATUS_COLORS: Record<GameStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  live: 'bg-green-100 text-green-700',
  finished: 'bg-gray-100 text-gray-500',
};

const STATUS_NEXT: Record<GameStatus, GameStatus | null> = {
  draft: 'live',
  live: 'finished',
  finished: null,
};

const STATUS_NEXT_LABEL: Record<GameStatus, string> = {
  draft: 'Go Live',
  live: 'Finish Game',
  finished: '',
};

export default function GameDetailPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [scheduledStart, setScheduledStart] = useState<string>('')
  const [scheduledEnd, setScheduledEnd] = useState<string>('')
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleMsg, setScheduleMsg] = useState<string>('')

  const loadGame = useCallback(async () => {
    const { data } = await supabase
      .from('mg_games')
      .select('*, mg_themes(name)')
      .eq('id', gameId)
      .single();
    if (data) setGame(data as Game);
        setScheduledStart(data.scheduled_start ? data.scheduled_start.slice(0, 16) : '')
        setScheduledEnd(data.scheduled_end ? data.scheduled_end.slice(0, 16) : '')
  }, [gameId]);

  const loadTeams = useCallback(async () => {
    const { data } = await supabase
      .from('mg_scores')
      .select('team_id, total_score, correct_count, mg_teams(id, name, company, captain_name)')
      .eq('game_id', gameId)
      .order('total_score', { ascending: false });
    if (data) {
      const rows = data.map((r: any) => ({
        id: r.mg_teams?.id ?? r.team_id,
        name: r.mg_teams?.name ?? 'Unknown',
        company: r.mg_teams?.company ?? null,
        captain_name: r.mg_teams?.captain_name ?? null,
        total_score: r.total_score ?? 0,
        correct_count: r.correct_count ?? 0,
      }));
      setTeams(rows);
    }
  }, [gameId]);

  useEffect(() => {
    Promise.all([loadGame(), loadTeams()]).finally(() => setLoading(false));
  }, [loadGame, loadTeams]);

  async function handleStatusChange() {
    if (!game || statusSaving) return;
    const next = STATUS_NEXT[game.status];
    if (!next) return;
    setStatusSaving(true);
    const { error } = await supabase
      .from('mg_games')
      .update({ status: next })
      .eq('id', gameId);
    if (!error) setGame(prev => prev ? { ...prev, status: next } : prev);
    setStatusSaving(false);
  }


  async function handleSaveSchedule() {
    setSavingSchedule(true)
    setScheduleMsg('')
    const startVal = scheduledStart ? new Date(scheduledStart).toISOString() : null
    const endVal = scheduledEnd ? new Date(scheduledEnd).toISOString() : null
    const { error } = await supabase
      .from('mg_games')
      .update({ scheduled_start: startVal, scheduled_end: endVal })
      .eq('id', params.gameId)
    setSavingSchedule(false)
    setScheduleMsg(error ? 'Error: ' + error.message : 'Schedule saved!')
    if (!error) setTimeout(() => setScheduleMsg(''), 3000)
  }
  function copyLink() {
    const url = `${window.location.origin}/score/${gameId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f4f8' }}>
        <p className="text-gray-400">Loadingâ¦</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0f4f8' }}>
        <p className="text-gray-500">Game not found.</p>
      </div>
    );
  }

  const scoreLink = typeof window !== 'undefined' ? `${window.location.origin}/score/${gameId}` : `/score/${gameId}`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="text-white px-6 py-4" style={{ backgroundColor: '#0F3460' }}>
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <a href="/admin" className="text-blue-200 hover:text-white text-sm">â Admin</a>
          <span className="text-blue-300">/</span>
          <h1 className="text-lg font-bold">{game.title}</h1>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[game.status]}`}>
            {game.status}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

        {/* Game Info Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <p className="text-gray-500 text-sm">
                Theme: <span className="text-gray-800 font-medium">{game.mg_themes?.name ?? 'â'}</span>
              </p>
          {/* Schedule Section */}
          <div className='mt-6 p-4 bg-gray-800 rounded-lg'>
            <h3 className='text-lg font-semibold text-white mb-4'>Session Schedule</h3>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-1'>Start Date & Time</label>
                <input
                  type='datetime-local'
                  value={scheduledStart}
                  onChange={e => setScheduledStart(e.target.value)}
                  className='bg-gray-700 text-white rounded px-3 py-2 w-full border border-gray-600 focus:border-blue-500 focus:outline-none'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-1'>End Date & Time</label>
                <input
                  type='datetime-local'
                  value={scheduledEnd}
                  onChange={e => setScheduledEnd(e.target.value)}
                  className='bg-gray-700 text-white rounded px-3 py-2 w-full border border-gray-600 focus:border-blue-500 focus:outline-none'
                />
              </div>
              <div className='flex items-center gap-3'>
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium'
                >
                  {savingSchedule ? 'Saving...' : 'Save Schedule'}
                </button>
                {scheduleMsg && <span className={scheduleMsg.startsWith('Error') ? 'text-red-400 text-sm' : 'text-green-400 text-sm'}>{scheduleMsg}</span>}
              </div>
            </div>
          </div>
              <p className="text-gray-500 text-sm">
                Points/Q: <span className="text-gray-800">{game.points_per_question}</span>
                {game.penalty_mode !== 'none' && <span className="ml-2 text-orange-600 text-xs">({game.penalty_mode} penalty)</span>}
              </p>
            </div>

            {/* Status controls */}
            <div className="flex flex-col gap-2 items-end">
              {STATUS_NEXT[game.status] && (
                <button
                  onClick={handleStatusChange}
                  disabled={statusSaving}
                  className="text-white px-5 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: game.status === 'draft' ? '#16a34a' : '#6b7280' }}
                >
                  {statusSaving ? 'Savingâ¦' : STATUS_NEXT_LABEL[game.status]}
                </button>
              )}
              <a
                href={`/admin/games/${gameId}/edit`}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit Settings
              </a>
            </div>
          </div>
        </div>

        {/* Scoring Link Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-3">Team Scoring Link</h2>
          <p className="text-gray-500 text-sm mb-3">Share this link with team captains to join and answer questions.</p>
          <div className="flex gap-3 items-center">
            <code className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate">
              {scoreLink}
            </code>
            <button
              onClick={copyLink}
              className="text-white px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0F3460' }}
            >
              {copyMsg || 'Copy'}
            </button>
            <a
              href={`/score/${gameId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Open â
            </a>
          </div>
        </div>

        {/* Teams / Leaderboard */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Teams ({teams.length})</h2>
            <button
              onClick={() => { loadTeams(); }}
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              â» Refresh
            </button>
          </div>

          {teams.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No teams have joined yet.</p>
          ) : (
            <div className="space-y-2">
              {teams.map((team, i) => (
                <div key={team.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{team.name}</p>
                    {team.company && <p className="text-xs text-gray-400">{team.company}{team.captain_name ? ` Â· ${team.captain_name}` : ''}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{team.total_score} pts</p>
                    <p className="text-xs text-gray-400">{team.correct_count} correct</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
