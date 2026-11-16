import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from './lib/adminAuth';

// Protects every admin page except the sign-in screen at /admin itself,
// and every admin API route except sign-in.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/api/admin/login') return NextResponse.next();

  const ok = await verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Your admin session has expired. Please sign in again.' },
      { status: 401 }
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = '/admin';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path+', '/api/admin/:path*'],
};
