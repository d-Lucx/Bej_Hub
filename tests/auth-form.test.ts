import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { POST } from '../app/auth/signin/route.js';

test('native login forms retain same-origin information while null and foreign origins remain blocked', async () => {
  const { default: config } = await import(pathToFileURL(resolve('next.config.mjs')).href);
  const headers = (await config.headers()).find((rule: any) => rule.source === '/:path*').headers;
  assert.equal(headers.find((header: any) => header.key === 'Referrer-Policy').value, 'same-origin');
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: 'production', BEJ_PUBLIC_URL: 'https://studio.example.com', BEJ_OWNER_EMAIL: 'owner@example.com', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
    const send = (origin: string) => POST(new Request('https://studio.example.com/auth/signin', { method: 'POST', headers: { host: 'studio.example.com', origin } }));
    for (const origin of ['null', 'https://attacker.example']) {
      const response = await send(origin); assert.equal(response.status, 403); assert.equal(response.headers.get('set-cookie'), null);
    }
    const response = await send('https://studio.example.com');
    assert.equal(response.status, 303);
    const target = new URL(response.headers.get('location')!);
    assert.equal(target.origin, 'https://project.supabase.co');
    assert.equal(target.searchParams.get('provider'), 'google');
    assert.equal(target.searchParams.get('redirect_to'), 'https://studio.example.com/auth/callback');
    assert(target.searchParams.has('code_challenge'));
    assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  } finally { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
});
