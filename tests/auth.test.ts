import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authPolicy, ownerAllowed, trustedRequest } from '../src/auth-policy.js';
import { officeAccess } from '../src/web-auth.js';
import { GET as office } from '../app/api/office/route.js';
import { POST as mission, PATCH as cancel } from '../app/api/missions/route.js';
import { POST as review } from '../app/api/reviews/route.js';

const env = { NODE_ENV: 'production', BEJ_PUBLIC_URL: 'https://studio.example.com', BEJ_OWNER_EMAIL: 'owner@example.com', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
function user(email = 'owner@example.com') { return { id: 'owner-id', email, email_confirmed_at: '2026-10-23', identities: [{ provider: 'google', identity_data: { email, email_verified: true } }] }; }
test('only a verified Google identity matching the exact owner email is allowed', () => {
  assert(ownerAllowed(user(), env.BEJ_OWNER_EMAIL));
  assert(!ownerAllowed(user('other@example.com'), env.BEJ_OWNER_EMAIL));
  assert(!ownerAllowed({ ...user(), identities: [{ provider: 'email' }] }, env.BEJ_OWNER_EMAIL));
  assert(!ownerAllowed({ ...user(), email_confirmed_at: null }, env.BEJ_OWNER_EMAIL));
  assert(!ownerAllowed({ ...user(), identities: [{ provider: 'google', identity_data: { email: 'owner@example.com', email_verified: false } }] }, env.BEJ_OWNER_EMAIL));
  assert(!ownerAllowed({ ...user(), user_metadata: { email: 'owner@example.com' }, email: 'other@example.com' }, env.BEJ_OWNER_EMAIL));
});
test('production cannot disable authentication, use HTTP, or authenticate with a service key', () => {
  assert.throws(() => authPolicy({ NODE_ENV: 'production', BEJ_AUTH_REQUIRED: 'false' }));
  assert.throws(() => authPolicy({ ...env, BEJ_PUBLIC_URL: 'http://studio.example.com' }));
  assert.throws(() => authPolicy({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }));
  const serviceJWT = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => authPolicy({ ...env, SUPABASE_PUBLISHABLE_KEY: serviceJWT }));
  assert.equal(authPolicy({ ...env, BEJ_AUTH_REQUIRED: 'false' }).required, true);
  assert.equal(authPolicy({ ...env, BEJ_PUBLIC_URL: undefined, RENDER_EXTERNAL_URL: env.BEJ_PUBLIC_URL }).origin, env.BEJ_PUBLIC_URL);
});
test('request checks reject foreign hosts, CSRF origins and spoofed forwarded hosts', () => {
  const policy = authPolicy(env);
  const request = (host: string, origin: string) => new Request(`${env.BEJ_PUBLIC_URL}/api/missions`, { headers: { host, origin, 'x-forwarded-host': 'studio.example.com' } });
  assert(trustedRequest(request('studio.example.com', env.BEJ_PUBLIC_URL), policy, true));
  assert(!trustedRequest(request('studio.example.com', 'https://attacker.example'), policy, true));
  assert(!trustedRequest(request('attacker.example', env.BEJ_PUBLIC_URL), policy, true));
  assert(!trustedRequest(request('localhost:3000', 'http://localhost:3000'), policy, true));
});
test('all private APIs reject anonymous cloud requests and fail closed without configuration', async () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, env);
    for (const [handler, method, path] of [[office, 'GET', 'office'], [mission, 'POST', 'missions'], [cancel, 'PATCH', 'missions'], [review, 'POST', 'reviews']] as const) {
      const request = new Request(`${env.BEJ_PUBLIC_URL}/api/${path}`, { method, headers: { host: 'studio.example.com', origin: env.BEJ_PUBLIC_URL }, ...(method === 'GET' ? {} : { body: '{}' }) });
      const response = await handler(request);
      assert.equal(response.status, 401);
      assert.match(response.headers.get('cache-control')!, /no-store/);
      assert(!await response.text().then(text => text.includes('source_text')));
    }
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    const denied = await officeAccess(new Request(env.BEJ_PUBLIC_URL, { headers: { host: 'studio.example.com' } }));
    assert.equal(denied.error?.status, 503);
  } finally { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
});
