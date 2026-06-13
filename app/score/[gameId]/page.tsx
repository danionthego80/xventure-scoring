'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type GameStatus = 'loading' | 'not_found' | 'before_start' | 'open' | 'showing_leaderboard' | 'finished' | 'closed';

interface Game {
  id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  theme_id: string | null;
  points_per_question: number;
  penalty_mode: string;
}

interface Question {
  id: string;
  title: string;
  instruction: string | null;
  points: number;
  media_url: string | null;
  order_num: number;
  mg_answer_options: AnswerOption[];
}

interface AnswerOption {
  id: string;
  label: string;
  text: string;
  is_correct: boolean;
  order_num: number;
}

interface Team {
  id: string;
  name: string;
  company: string;
  captain: string;
  join_token: string;
}

interface Submission {
  question_id: string;
  answer_option_id: string;
  is_correct: boolean;
  points_awarded: number;
}

interface ScoreRow {
  team_id: string;
  total_points: number;
  questions_correct: number;
  questions_answered: number;
  mg_teams: { name: string } | { name: string }[] | null;
}

export default function ScorePage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;

  const [pageStatus, setPageStatus] = useState<GameStatus>('loading');
  const [game, setGame] = useState<Game | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<ScoreRow[]>([]);
  const [timeUntilStart, setTimeUntilStart] = useState('');
  const [leaderboardTimeout, setLeaderboardTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [lastAnswerPoints, setLastAnswerPoints] = useState<number>(0);

  // Join form state
  const [teamName, setTeamName] = useState('');
  const [company, setCompany] = useState('');
  const [captain, setCaptain] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  // Selected answer state (per question)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  const STORAGE_KEY = `mg_team_${gameId}`;

  // Determine page status from game data
  const determineStatus = useCallback((g: Game): GameStatus => {
    const now = new Date();
    const start = g.scheduled_start ? new Date(g.scheduled_start) : null;
    const end = g.scheduled_end ? new Date(g.scheduled_end) : null;

    if (g.status === 'finished') return 'finished';
    if (end && now > end) return 'closed';
    if (start && now < start) return 'before_start';
    return 'open';
  }, []);

  // Load game data
  useEffect(() => {
    async function loadGame() {
      const { data, error } = await supabase
        .from('mg_games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error || !data) {
        setPageStatus('not_found');
        return;
      }

      setGame(data);
      const status = determineStatus(data);
      setPageStatus(status);

      if (status === 'open') {
        loadQuestions(data.theme_id);
        checkStoredTeam();
      }
    }

    loadGame();
  }, [gameId, determineStatus]);

  // Countdown timer for before_start
  useEffect(() => {
    if (pageStatus !== 'before_start' || !game?.scheduled_start) return;

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(game.scheduled_start!);
      const diff = start.getTime() - now.getTime();

      if (diff <= 0) {
        clearInterval(interval);
        setPageStatus('open');
        loadQuestions(game.theme_id);
        checkStoredTeam();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeUntilStart(
        hours > 0
          ? `${hours}h ${mins}m ${secs}s`
          : mins > 0
          ? `${mins}m ${secs}s`
          : `${secs}s`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [pageStatus, game]);

  // Check session end time polling
  useEffect(() => {
    if (pageStatus !== 'open' || !game?.scheduled_end) return;

    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(game.scheduled_end!);
      if (now >= end) {
        clearInterval(interval);
        showFinalLeaderboard();
      }
    }, 10000); // check every 10 seconds

    return () => clearInterval(interval);
  }, [pageStatus, game]);

  async function loadQuestions(themeId: string | null) {
    if (!themeId) return;
    const { data } = await supabase
      .from('mg_questions')
      .select('*, mg_answer_options(id, label, text, is_correct, order_num)')
      .eq('theme_id', themeId)
      .order('order_num');
    if (data) setQuestions(data);
  }

  function checkStoredTeam() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const t = JSON.parse(stored) as Team;
        setTeam(t);
        loadSubmissions(t.id);
      } catch {}
    }
  }

  async function loadSubmissions(teamId: string) {
    const { data } = await supabase
      .from('mg_submissions')
      .select('*')
      .eq('team_id', teamId);
    if (data) setSubmissions(data);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setJoining(true);
    setJoinError('');

    // Check for duplicate team name
    const { data: existing } = await supabase
      .from('mg_teams')
      .select('id')
      .eq('game_id', gameId)
      .ilike('name', teamName.trim());

    if (existing && existing.length > 0) {
      setJoinError('That team name is already taken. Please choose a different name.');
      setJoining(false);
      return;
    }

    const { data, error } = await supabase
      .from('mg_teams')
      .insert({ game_id: gameId, name: teamName.trim(), company: company.trim(), captain: captain.trim() })
      .select()
      .single();

    if (error || !data) {
      setJoinError('Failed to join. Please try again.');
      setJoining(false);
      return;
    }

    // Create initial score record
    await supabase.from('mg_scores').insert({
      team_id: data.id,
      game_id: gameId,
      total_points: 0,
      questions_correct: 0,
      questions_answered: 0
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setTeam(data);
    setJoining(false);
  }

  async function handleSubmitAnswer() {
    if (!selectedAnswer || !activeQuestion || !team || submitting) return;
    setSubmitting(true);

    const option = activeQuestion.mg_answer_options.find(o => o.id === selectedAnswer);
    if (!option) { setSubmitting(false); return; }

    const isCorrect = option.is_correct;
    let points = 0;
    if (isCorrect) {
      points = activeQuestion.points;
    } else if (game?.penalty_mode === 'partial') {
      points = -(activeQuestion.points / 5);
    } else if (game?.penalty_mode === 'full') {
      points = -activeQuestion.points;
    }

    const { error } = await supabase.from('mg_submissions').insert({
      team_id: team.id,
      question_id: activeQuestion.id,
      answer_option_id: selectedAnswer,
      is_correct: isCorrect,
      points_awarded: points
    });

    if (error) {
      setSubmitting(false);
      return;
    }

    // Update cached score
    const current = submissions.reduce((sum, s) => sum + s.points_awarded, 0);
    await supabase.from('mg_scores').upsert({
      team_id: team.id,
      game_id: gameId,
      total_points: current + points,
      questions_correct: submissions.filter(s => s.is_correct).length + (isCorrect ? 1 : 0),
      questions_answered: submissions.length + 1,
      last_updated: new Date().toISOString()
    }, { onConflict: 'team_id,game_id' });

    const newSub: Submission = {
      question_id: activeQuestion.id,
      answer_option_id: selectedAnswer,
      is_correct: isCorrect,
      points_awarded: points
    };
    setSubmissions(prev => [...prev, newSub]);
    setLastAnswerCorrect(isCorrect);
    setLastAnswerPoints(points);
    setSubmitting(false);

    // Show leaderboard for 5 seconds
    await fetchLeaderboard();
    setPageStatus('showing_leaderboard');
    const t = setTimeout(() => {
      setPageStatus('open');
      setActiveQuestion(null);
      setSelectedAnswer(null);
    }, 5000);
    setLeaderboardTimeout(t);
  }

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('mg_scores')
      .select('team_id, total_points, questions_correct, questions_answered, mg_teams(name)')
      .eq('game_id', gameId)
      .order('total_points', { ascending: false })
      .order('questions_correct', { ascending: false })
      .limit(10);
    if (data) setLeaderboard(data.map((row: any) => ({ ...row, mg_teams: Array.isArray(row.mg_teams) ? row.mg_teams[0] ?? null : row.mg_teams })));
  }

  async function showFinalLeaderboard() {
    await fetchLeaderboard();
    setPageStatus('finished');
    // Auto-close after 2 minutes
    setTimeout(() => setPageStatus('closed'), 120000);
  }

  const submittedQuestionIds = new Set(submissions.map(s => s.question_id));
  const allAnswered = questions.length > 0 && submittedQuestionIds.size >= questions.length;

  // ─── RENDER STATES ───────────────────────────────────────────────────────────

  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F3460' }}>
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-2">XVenture Mind Games</div>
          <div className="text-blue-200">Loading...</div>
        </div>
      </div>
    );
  }

  if (pageStatus === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F3460' }}>
        <div className="text-white text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Session Not Found</h1>
          <p className="text-blue-200">This scoring link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'before_start') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F3460' }}>
        <div className="text-white text-center px-6">
          <div className="text-5xl mb-6">🎮</div>
          <h1 className="text-3xl font-bold mb-2">XVenture Mind Games</h1>
          <p className="text-xl text-blue-200 mb-8">{game?.title}</p>
          <div className="bg-white bg-opacity-10 rounded-2xl p-8 inline-block">
            <p className="text-blue-200 text-sm mb-2">Session opens in</p>
            <p className="text-5xl font-bold font-mono">{timeUntilStart || '...'}</p>
          </div>
          {game?.scheduled_start && (
            <p className="text-blue-300 text-sm mt-6">
              Starts at {new Date(game.scheduled_start).toLocaleString('en-AU', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Australia/Sydney'
              })}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (pageStatus === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F3460' }}>
        <div className="text-white text-center px-6">
          <div className="text-5xl mb-6">🏁</div>
          <h1 className="text-2xl font-bold mb-2">Session Complete</h1>
          <p className="text-blue-200">This scoring session has ended. Thanks for playing!</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'finished' || pageStatus === 'showing_leaderboard') {
    const isFinal = pageStatus === 'finished';
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0F3460' }}>
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center text-white mb-8">
            <div className="text-4xl mb-3">{isFinal ? '🏆' : '📊'}</div>
            <h1 className="text-2xl font-bold">{isFinal ? 'Final Leaderboard' : 'Current Standings'}</h1>
            {!isFinal && lastAnswerCorrect !== null && (
              <div className={`mt-3 text-lg font-semibold ${lastAnswerCorrect ? 'text-green-300' : 'text-red-300'}`}>
                {lastAnswerCorrect ? `✅ Correct! +${lastAnswerPoints} pt${lastAnswerPoints !== 1 ? 's' : ''}` : `❌ Incorrect${lastAnswerPoints < 0 ? ` (${lastAnswerPoints} pts)` : ''}`}
              </div>
            )}
            {!isFinal && <p className="text-blue-200 text-sm mt-1">Returning to questions shortly...</p>}
          </div>

          <div className="space-y-2">
            {leaderboard.map((row, i) => (
              <div
                key={row.team_id}
                className={`flex items-center gap-4 rounded-xl p-4 ${
                  i === 0 ? 'bg-yellow-400 text-gray-900' :
                  i === 1 ? 'bg-gray-300 text-gray-900' :
                  i === 2 ? 'bg-amber-600 text-white' :
                  'bg-white bg-opacity-10 text-white'
                }`}
              >
                <div className="text-2xl font-bold w-8 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{(row.mg_teams as any)?.name ?? 'Unknown'}</p>
                  <p className="text-xs opacity-75">{row.questions_correct} correct · {row.questions_answered} answered</p>
                </div>
                <div className="text-xl font-bold">{row.total_points} pts</div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-blue-200 text-center py-8">No scores yet</p>
            )}
          </div>

          {isFinal && (
            <p className="text-center text-blue-300 text-sm mt-8">
              This screen will close in 2 minutes
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── OPEN STATE ──────────────────────────────────────────────────────────────

  // Join form (if no team yet)
  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F3460' }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🎮</div>
            <h1 className="text-xl font-bold" style={{ color: '#0F3460' }}>Join the Game</h1>
            <p className="text-gray-500 text-sm">{game?.title}</p>
          </div>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. The Thinkers"
                required
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your company name"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Captain Name</label>
              <input
                type="text"
                value={captain}
                onChange={e => setCaptain(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your name"
                maxLength={100}
              />
            </div>
            {joinError && <p className="text-red-500 text-sm">{joinError}</p>}
            <button
              type="submit"
              disabled={joining || !teamName.trim()}
              className="w-full text-white rounded-lg py-3 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#0F3460' }}
            >
              {joining ? 'Joining...' : 'Join Game →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active question view
  if (activeQuestion) {
    const alreadySubmitted = submittedQuestionIds.has(activeQuestion.id);
    const mySubmission = submissions.find(s => s.question_id === activeQuestion.id);
    const correctOption = activeQuestion.mg_answer_options.find(o => o.is_correct);

    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0F3460' }}>
        <div className="max-w-lg mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => { setActiveQuestion(null); setSelectedAnswer(null); }}
              className="text-blue-300 hover:text-white transition-colors text-sm"
            >
              ← Back to Questions
            </button>
            <span className="text-blue-300 text-sm">{team.name}</span>
          </div>

          {/* Question */}
          <div className="bg-white rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">{activeQuestion.title}</h2>
            {activeQuestion.instruction && (
              <p className="text-gray-500 text-sm mb-4">{activeQuestion.instruction}</p>
            )}
            {activeQuestion.media_url && (
              <img src={activeQuestion.media_url} alt="" className="w-full rounded-lg mb-4 max-h-48 object-cover" />
            )}

            {/* Answer options */}
            <div className="space-y-3 mt-4">
              {activeQuestion.mg_answer_options
                .sort((a, b) => a.order_num - b.order_num)
                .map(option => {
                  let btnClass = 'w-full text-left rounded-xl p-4 border-2 transition-all text-gray-900 ';
                  if (alreadySubmitted) {
                    if (option.is_correct) btnClass += 'border-green-500 bg-green-50 text-green-800';
                    else if (mySubmission?.answer_option_id === option.id) btnClass += 'border-red-400 bg-red-50 text-red-800';
                    else btnClass += 'border-gray-200 bg-gray-50 text-gray-400';
                  } else if (selectedAnswer === option.id) {
                    btnClass += 'border-blue-500 bg-blue-50 text-blue-800';
                  } else {
                    btnClass += 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer';
                  }

                  return (
                    <button
                      key={option.id}
                      onClick={() => !alreadySubmitted && setSelectedAnswer(option.id)}
                      disabled={alreadySubmitted}
                      className={btnClass}
                    >
                      <span className="font-bold mr-3">{option.label}</span>
                      <span>{option.text}</span>
                      {alreadySubmitted && option.is_correct && <span className="ml-2">✅</span>}
                      {alreadySubmitted && mySubmission?.answer_option_id === option.id && !option.is_correct && <span className="ml-2">❌</span>}
                    </button>
                  );
                })}
            </div>

            {/* Submit or result */}
            {!alreadySubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={!selectedAnswer || submitting}
                className="w-full mt-6 text-white rounded-xl py-3 font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#0F3460' }}
              >
                {submitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            ) : (
              <div className={`mt-6 rounded-xl p-4 text-center font-semibold ${mySubmission?.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
                {mySubmission?.is_correct ? `✅ Correct! +${mySubmission.points_awarded} pt${mySubmission.points_awarded !== 1 ? 's' : ''}` : `❌ Incorrect. Correct answer: ${correctOption?.text ?? ''}`}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Question list view
  const myTotalPoints = submissions.reduce((sum, s) => sum + Number(s.points_awarded), 0);
  const myCorrect = submissions.filter(s => s.is_correct).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F3460' }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-white mb-6">
          <h1 className="text-2xl font-bold">{game?.title}</h1>
          <p className="text-blue-200 text-sm mt-1">{team.name}</p>
        </div>

        {/* Score summary */}
        <div className="bg-white bg-opacity-10 rounded-2xl p-5 mb-6 flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{myTotalPoints}</p>
            <p className="text-blue-300 text-xs">pts</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{myCorrect}</p>
            <p className="text-blue-300 text-xs">correct</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{submittedQuestionIds.size}/{questions.length}</p>
            <p className="text-blue-300 text-xs">answered</p>
          </div>
        </div>

        {/* All answered message */}
        {allAnswered && (
          <div className="bg-green-400 bg-opacity-20 border border-green-400 rounded-xl p-4 mb-6 text-center">
            <p className="text-green-300 font-semibold">🎉 All questions answered!</p>
            <p className="text-green-400 text-sm mt-1">Final results will show when the session ends.</p>
          </div>
        )}

        {/* Questions list */}
        <div className="space-y-3">
          {questions
            .sort((a, b) => a.order_num - b.order_num)
            .map((q, i) => {
              const done = submittedQuestionIds.has(q.id);
              const sub = submissions.find(s => s.question_id === q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => { setActiveQuestion(q); setSelectedAnswer(null); }}
                  className={`w-full text-left rounded-xl p-4 transition-all ${
                    done
                      ? sub?.is_correct
                        ? 'bg-green-500 bg-opacity-20 border border-green-500'
                        : 'bg-red-500 bg-opacity-20 border border-red-400'
                      : 'bg-white bg-opacity-10 border border-white border-opacity-20 hover:bg-opacity-20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-medium opacity-60">Q{i + 1}</span>
                      <span className="text-white font-medium">{q.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {done && (
                        <span className="text-sm">
                          {sub?.is_correct ? '✅' : '❌'}
                        </span>
                      )}
                      {!done && (
                        <span className="text-blue-300 text-sm">→</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        {questions.length === 0 && (
          <div className="text-center text-blue-200 py-12">
            <p>Questions are being loaded...</p>
          </div>
        )}
      </div>
    </div>
  );
}
