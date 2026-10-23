import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/reviews/route.js';

test('web review endpoint rejects foreign origins and invalid mission IDs before writing', async () => {
  const foreign = new Request('http://127.0.0.1:3000/api/reviews', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'https://example.com' }, body: '{}' });
  assert.equal((await POST(foreign)).status, 403);
  const invalid = new Request('http://127.0.0.1:3000/api/reviews', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' }, body: JSON.stringify({ id: '../../outside', action: 'approve' }) });
  assert.equal((await POST(invalid)).status, 400);
  const clarification = new Request('http://127.0.0.1:3000/api/reviews', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' }, body: JSON.stringify({ id: 'c4ae0e1a-e180-4f68-b3ae-2c3dba75a649', action: 'clarify' }) });
  assert.equal((await POST(clarification)).status, 400);
});
