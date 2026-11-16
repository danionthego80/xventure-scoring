// Admin session handling. Runs on the server (API routes and middleware) only.
// The admin password lives in the ADMIN_PASSWORD environment variable, which is
// never sent to the browser. A signed, httpOnly cookie proves the admin signed in.

export const ADMIN_COOKIE = 'xv_admin_session';
const SESSION_HOURS = 12;

function getSecret(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length > 0 ? pw : null;
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdminConfigured(): boolean {
  return getSecret() !== null;
}

export async function checkPassword(password: string): Promise<boolean> {
  const secret = getSecret();
  if (!secret || typeof password !== 'string') return false;
  // Compare HMACs so the comparison takes the same time whatever is typed.
  const [a, b] = await Promise.all([hmac(secret, 'pw:' + password), hmac(secret, 'pw:' + secret)]);
  return safeEqual(a, b);
}

export async function createSessionToken(): Promise<{ token: string; maxAge: number }> {
  const secret = getSecret();
  if (!secret) throw new Error('ADMIN_PASSWORD is not set');
  const maxAge = SESSION_HOURS * 60 * 60;
  const expires = String(Date.now() + maxAge * 1000);
  const sig = await hmac(secret, 'session:' + expires);
  return { token: `${expires}.${sig}`, maxAge };
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig || !/^\d+$/.test(expires)) return false;
  if (Number(expires) < Date.now()) return false;
  const expected = await hmac(secret, 'session:' + expires);
  return safeEqual(sig, expected);
}
