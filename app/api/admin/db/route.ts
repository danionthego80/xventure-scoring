import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Runs admin database queries with the server-only service key.
// Only reachable by a signed-in admin (see middleware.ts).

const TABLES = new Set([
  'mg_themes',
  'mg_games',
  'mg_questions',
  'mg_answer_options',
  'mg_teams',
  'mg_scores',
  'mg_submissions',
]);

const METHODS = new Set([
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'in',
  'is',
  'order',
  'limit',
  'single',
  'maybeSingle',
]);

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { data: null, error: { message: 'Server is missing its Supabase settings.' } },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Bad request' } }, { status: 400 });
  }

  const { table, ops } = body || {};
  if (typeof table !== 'string' || !TABLES.has(table) || !Array.isArray(ops)) {
    return NextResponse.json({ data: null, error: { message: 'Bad request' } }, { status: 400 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let query: any = supabase.from(table);
  for (const op of ops) {
    if (!Array.isArray(op) || typeof op[0] !== 'string' || !METHODS.has(op[0])) {
      return NextResponse.json({ data: null, error: { message: 'Bad request' } }, { status: 400 });
    }
    const [method, ...args] = op;
    query = query[method](...args);
  }

  const { data, error, count } = await query;
  return NextResponse.json({
    data: data ?? null,
    count: count ?? null,
    error: error ? { message: error.message, code: error.code } : null,
  });
}
