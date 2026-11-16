import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  checkPassword,
  createSessionToken,
  isAdminConfigured,
  verifySessionToken,
} from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

// Is the current visitor signed in as admin?
export async function GET(request: NextRequest) {
  const ok = await verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ authenticated: ok, configured: isAdminConfigured() });
}

// Sign in
export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Admin password has not been set up on the server (ADMIN_PASSWORD).' },
      { status: 503 }
    );
  }
  let password = '';
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {}

  if (!(await checkPassword(password))) {
    // Small delay to slow down guessing.
    await new Promise(r => setTimeout(r, 600));
    return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
  }

  const { token, maxAge } = await createSessionToken();
  const res = NextResponse.json({ authenticated: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  return res;
}

// Sign out
export async function DELETE() {
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
