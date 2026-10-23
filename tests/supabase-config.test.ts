import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supabaseSettings } from '../src/supabase-config.js';
test('new secret keys are sent only as apikey; legacy JWT keys also use Bearer', () => {
  const modern = supabaseSettings({ SUPABASE_URL: 'https://bej-test.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_fake' });
  assert.equal(modern.url, 'https://bej-test.supabase.co');
  assert.equal(modern.headers.apikey, 'sb_secret_fake');
  assert.equal(modern.headers.Authorization, undefined);
  const legacy = supabaseSettings({ SUPABASE_URL: 'https://bej-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJfake' });
  assert.equal(legacy.headers.Authorization, 'Bearer eyJfake');
});
test('invalid destination and browser keys are rejected without revealing secrets', () => {
  assert.throws(() => supabaseSettings({ SUPABASE_URL: 'https://wrong.example', SUPABASE_SECRET_KEY: 'sb_secret_fake' }), /HTTPS project URL/);
  assert.throws(() => supabaseSettings({ SUPABASE_URL: 'https://bej-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_publishable_fake' }), /server secret key/);
});
