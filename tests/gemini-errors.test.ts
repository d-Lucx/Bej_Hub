import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geminiFailure } from '../src/gemini-errors.js';
import { GeminiProvider } from '../src/providers.js';

test('temporary quota failure respects both server delay mechanisms', async () => {
  let calls = 0;
  const waits: number[] = [];
  const request = (async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ error: { details: [{ retryDelay: '12s' }] } }), { status: 429, headers: { 'retry-after': '15' } });
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ research_goal: 'Research', writing_goal: 'Write' }) }] } }] }));
  }) as typeof fetch;
  const provider = new GeminiProvider('secret', 'test', request, async ms => { waits.push(ms); });
  await provider.plan('topic');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [15000]);
});

test('daily and zero quotas stop retries; errors redact the API key', () => {
  for (const violation of [{ quotaId: 'GenerateRequestsPerDayPerProject', quotaValue: '500' }, { quotaId: 'SearchRequests', quotaValue: '0' }]) {
    const result = geminiFailure(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded secret', details: [{ violations: [violation] }] } }, null, 'secret', 0);
    assert.equal(result.retry, false);
    assert(!result.message.includes('secret'));
    assert(result.message.includes(violation.quotaId));
  }
});

test('long delays stop instead of retrying too early; retries remain bounded', () => {
  assert.equal(geminiFailure(429, { error: { details: [{ retryDelay: '3600s' }] } }, null, '', 0).retry, false);
  assert.equal(geminiFailure(429, null, null, '', 2).retry, false);
  assert.equal(geminiFailure(400, null, null, '', 0).retry, false);
  assert.equal(geminiFailure(503, null, null, '', 0).retry, true);
});
