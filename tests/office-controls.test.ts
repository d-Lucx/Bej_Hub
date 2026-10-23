import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { enqueue, cancelQueued, transitionQueue } from '../src/queue-store.js';
import { parseBotStatus } from '../src/bot-status.js';
import { projectOffice } from '../src/office-state.js';
import type { Mission } from '../src/contracts.js';

async function withQueue(fn: (directory: string) => Promise<void>) {
  const root = resolve('data/test-workspaces');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, 'queue-'));
  try { await fn(directory); }
  finally { assert(directory.startsWith(root + '\\') || directory.startsWith(root + '/')); await rm(directory, { recursive: true, force: true }); }
}
test('cancelled work cannot be claimed, and running work cannot be cancelled', async () => {
  await withQueue(async directory => {
    const entry = await enqueue({ prompt: 'Draft a welcome post', sources: 'Supplied project notes' }, directory);
    const file = (await readdir(directory)).find(name => name.endsWith('.json'))!;
    assert.equal(await cancelQueued(entry.id, directory), true);
    assert.equal(await transitionQueue(join(directory, file), 'QUEUED', 'RUNNING'), null);
    assert.equal(JSON.parse(await readFile(join(directory, file), 'utf8')).status, 'CANCELLED');
    const second = await enqueue({ prompt: 'Another mission', sources: 'Notes' }, directory);
    const path = join(directory, (await readdir(directory)).find(name => name.endsWith(`${second.id}.json`))!);
    assert(await transitionQueue(path, 'QUEUED', 'RUNNING'));
    assert.equal(await cancelQueued(second.id, directory), false);
  });
});
test('claim and cancellation race resolves to exactly one winner', async () => {
  await withQueue(async directory => {
    const entry = await enqueue({ prompt: 'Race test', sources: 'Notes' }, directory);
    const path = join(directory, (await readdir(directory))[0]);
    const [claim, cancel] = await Promise.all([transitionQueue(path, 'QUEUED', 'RUNNING'), cancelQueued(entry.id, directory)]);
    assert.equal(Number(!!claim) + Number(cancel), 1);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(saved.status, claim ? 'RUNNING' : 'CANCELLED');
  });
});
test('missing sources and path-like IDs are rejected', async () => {
  await withQueue(async directory => {
    await assert.rejects(enqueue({ prompt: 'Task', sources: ' ' }, directory));
    await assert.rejects(cancelQueued('../mission', directory));
    assert.deepEqual(await readdir(directory), []);
  });
});
test('bot liveness expires and rejects invalid/future timestamps', () => {
  const now = Date.now();
  assert.equal(parseBotStatus({ online: true, updatedAt: new Date(now - 3000).toISOString() }, now).online, true);
  assert.equal(parseBotStatus({ online: true, updatedAt: new Date(now - 16000).toISOString() }, now).online, false);
  assert.equal(parseBotStatus({ online: true, updatedAt: 'invalid' }, now).online, false);
  assert.equal(parseBotStatus({ online: true, updatedAt: new Date(now + 10000).toISOString() }, now).online, false);
});
test('failed mission keeps supplied references available for review and retry', () => {
  const mission: Mission = { id: 'test', prompt: 'Draft', created_by: 'owner', mode: 'mock', status: 'FAILED', tokens_used: 0, created_at: new Date().toISOString(), events: [], source_text: 'Original reference text' };
  const office = projectOffice([mission]);
  assert.equal(office.missions[0].retry_sources, 'Original reference text');
  assert.equal(office.agents[0].state, 'BLOCKED');
});
