import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { GeminiProvider, MockProvider } from '../src/providers.js';
import { Studio } from '../src/studio.js';

test('supplied analysis omits tools and preserves source provenance for Writer', async () => {
  const requests: any[] = [];
  const request = (async (_url: any, init: any) => {
    requests.push(JSON.parse(init.body));
    const text = requests.length === 1 ? JSON.stringify({ brief: 'Bej Hub has three roles. [S1]' }) : JSON.stringify({ title: 'Welcome', body: 'Three roles help with missions. [S1]' });
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }], usageMetadata: { totalTokenCount: 30 } }));
  }) as typeof fetch;
  const provider = new GeminiProvider('fake', 'test', request);
  const result = await provider.research('Describe roles', 'Bej Hub has three roles.');
  assert.equal(result.value.source_kind, 'supplied');
  assert.equal(result.value.supplied_text, 'Bej Hub has three roles.');
  assert.equal(result.value.grounding, null);
  assert.deepEqual(result.value.sources, []);
  await provider.write('Welcome post', result.value);
  assert(requests.every(body => !('tools' in body)));
  assert(requests[1].contents[0].parts[0].text.includes('not verified web research'));
  await assert.rejects(provider.research('Topic', ' '), /Source text/);
  assert.equal(requests.length, 2);
});

test('supplied workflow rejects missing evidence, labels delivery, and saves reference text', async () => {
  await mkdir('data/test-workspaces', { recursive: true });
  const directory = await mkdtemp(join('data/test-workspaces', 'supplied-'));
  try {
    const messages: string[] = [];
    const studio = new Studio(new MockProvider(), { async send(_role, text) { messages.push(text); } }, directory, 'supplied');
    await assert.rejects(studio.run('Welcome post', 'owner'), /reference text/);
    assert.equal(studio.active, undefined);
    const result = await studio.run('Welcome post', 'owner', 'Bej Hub is a virtual studio.');
    assert.equal(result.status, 'COMPLETED');
    assert(messages.some(text => text.includes('DRAFT · MOCK · SUPPLIED SOURCES')));
    assert(messages.some(text => text.includes('Not independently verified')));
    const saved = JSON.parse(await readFile(join(directory, `${result.id}.json`), 'utf8'));
    assert.equal(saved.brief.supplied_text, 'Bej Hub is a virtual studio.');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
