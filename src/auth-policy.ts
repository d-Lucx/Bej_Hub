import { z } from 'zod';

export function authPolicy(env: NodeJS.ProcessEnv = process.env) {
  const required = env.NODE_ENV === 'production' || env.RENDER === 'true' || env.BEJ_AUTH_REQUIRED === 'true' || !!env.BEJ_PUBLIC_URL;
  if (!required) return { required: false as const, origin: '', owner: '', url: '', key: '' };
  const origin = new URL(env.BEJ_PUBLIC_URL || env.RENDER_EXTERNAL_URL || 'invalid');
  const local = ['localhost', '127.0.0.1'].includes(origin.hostname);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || (origin.protocol !== 'https:' && !(local && env.NODE_ENV !== 'production' && origin.protocol === 'http:'))) throw new Error('Set BEJ_PUBLIC_URL to the exact HTTPS office origin.');
  const owner = z.email().parse(env.BEJ_OWNER_EMAIL?.trim().toLowerCase());
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key) throw new Error('Configure the Supabase Auth URL and publishable key.');
  // Never use the service-role credential for user authentication.
  if (!key.startsWith('sb_publishable_')) {
    try { if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') throw new Error(); }
    catch { throw new Error('Use the Supabase publishable or legacy anon key for Auth.'); }
  }
  return { required: true as const, origin: origin.origin, owner, url, key };
}
export type AuthPolicy = ReturnType<typeof authPolicy>;
export function trustedRequest(request: Request, policy: AuthPolicy, mutation = false) {
  const host = request.headers.get('host')?.toLowerCase();
  const origin = policy.required ? policy.origin : `http://${host}`;
  if (policy.required ? host !== new URL(origin).host : !['localhost:3000', '127.0.0.1:3000'].includes(host ?? '')) return false;
  return !mutation || request.headers.get('origin') === origin;
}
export function ownerAllowed(user: any, owner: string) {
  return !!user?.id && !!user.email_confirmed_at && user.email?.toLowerCase() === owner && Array.isArray(user.identities) && user.identities.some((identity: any) => identity.provider === 'google' && identity.identity_data?.email_verified === true && identity.identity_data?.email?.toLowerCase() === owner);
}
