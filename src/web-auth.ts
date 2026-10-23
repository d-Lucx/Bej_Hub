import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import { authPolicy, ownerAllowed, trustedRequest } from './auth-policy.ts';

export function authContext(request: Request) {
  const policy = authPolicy();
  const jar = new Map(parseCookieHeader(request.headers.get('cookie') ?? '').map(cookie => [cookie.name, cookie.value ?? '']));
  const changes: string[] = [];
  const client = policy.required ? createServerClient(policy.url, policy.key, {
    cookieOptions: { httpOnly: true, secure: policy.origin.startsWith('https:'), sameSite: 'lax', path: '/' },
    cookies: {
      getAll() { return [...jar].map(([name, value]) => ({ name, value })); },
      setAll(cookies) { for (const { name, value, options } of cookies) { jar.set(name, value); changes.push(serializeCookieHeader(name, value, { ...options, httpOnly: true, secure: policy.origin.startsWith('https:'), sameSite: 'lax', path: '/' })); } },
    },
  }) : null;
  return { policy, client, requestCookies: () => [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; '), finish(response: Response) { response.headers.set('Cache-Control', 'private, no-store'); for (const cookie of changes) response.headers.append('Set-Cookie', cookie); return response; } };
}
export async function officeAccess(request: Request, mutation = false) {
  let context: ReturnType<typeof authContext>;
  try { context = authContext(request); }
  catch { return { error: Response.json({ error: 'Private office security is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }; }
  const deny = (message: string, status: number) => ({ ...context, error: context.finish(Response.json({ error: message }, { status })) });
  if (!trustedRequest(request, context.policy, mutation)) return deny('This request is not from the configured office.', 403);
  if (!context.client) return { ...context, error: undefined, email: undefined };
  try {
    // getUser validates the session with the Auth server, including revocation.
    const { data, error } = await context.client.auth.getUser();
    if (error || !data.user) return deny('Sign in to your private office.', 401);
    if (!ownerAllowed(data.user, context.policy.owner)) return deny('This Google account is not allowed to enter this office.', 403);
    return { ...context, error: undefined, email: data.user.email };
  } catch { return deny('Sign-in verification is temporarily unavailable.', 503); }
}
