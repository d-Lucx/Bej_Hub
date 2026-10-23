import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authContext, officeAccess } from '../src/web-auth.js';

test('server authorization trusts Auth verification instead of a forged owner cookie, and OAuth uses protected PKCE cookies', async () => {
  const saved = { ...process.env }; const originalFetch = globalThis.fetch;
  const owner = { id: 'c4ae0e1a-e180-4f68-b3ae-2c3dba75a649', email: 'owner@example.com', email_confirmed_at: new Date().toISOString(), identities: [{ provider: 'google', identity_data: { email: 'owner@example.com', email_verified: true } }] };
  try {
    Object.assign(process.env, { NODE_ENV: 'production', BEJ_PUBLIC_URL: 'https://studio.example.com', BEJ_OWNER_EMAIL: 'owner@example.com', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
    const session = { access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: owner };
    const request = () => new Request('https://studio.example.com/api/office', { headers: { host: 'studio.example.com', cookie: `sb-project-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}` } });
    let verified = owner;
    let checks = 0;
    globalThis.fetch = (async (input, init) => {
      assert.match(String(input), /\/auth\/v1\/user$/); checks++;
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-access-token');
      return Response.json(verified);
    }) as typeof fetch;
    const allowed = await officeAccess(request()); assert.equal(allowed.error, undefined); assert.equal(allowed.email, owner.email);
    verified = { ...owner, email: 'other@example.com' };
    const denied = await officeAccess(request()); assert.equal(denied.error?.status, 403); assert.equal(checks, 2);
    const context = authContext(new Request('https://studio.example.com/auth/signin'));
    const { data, error } = await context.client!.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true, redirectTo: 'https://studio.example.com/auth/callback' } });
    assert.equal(error, null); assert.match(data.url!, /code_challenge=/);
    const cookies = context.finish(new Response()).headers.get('set-cookie')!;
    assert.match(cookies, /HttpOnly/i); assert.match(cookies, /Secure/i); assert.match(cookies, /SameSite=Lax/i);
  } finally { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
});
