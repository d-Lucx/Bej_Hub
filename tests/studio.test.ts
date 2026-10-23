import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Studio } from '../src/studio.js';
import { MockProvider, GeminiProvider } from '../src/providers.js';
import { authorized, chunks } from '../src/discord.js';

test('mock workflow persists handoffs, delivers draft, and uses zero tokens', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bej-test-'));
  try {
    const messages: string[] = [];
    const studio = new Studio(new MockProvider(), { async send(role, text) { messages.push(`${role}:${text}`); } }, directory);
    const mission = await studio.run('Test a studio introduction', 'owner');
    assert.equal(mission.status, 'COMPLETED');
    assert.equal(mission.tokens_used, 0);
    assert.equal(mission.brief?.mock, true);
    assert.deepEqual(mission.events.filter(e => e.next_state === 'HANDOFF').map(e => e.target_agent), ['researcher', 'writer']);
    assert(messages.some(message => message.startsWith('writer:DRAFT · MOCK')));
    assert.equal(JSON.parse(await readFile(join(directory, `${mission.id}.json`), 'utf8')).status, 'COMPLETED');
    assert.equal(studio.active, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('failure releases the mission slot and records BLOCKED', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bej-test-'));
  try {
    const provider = new MockProvider();
    provider.research = async () => { throw new Error('No grounded sources'); };
    const studio = new Studio(provider, { async send() {} }, directory);
    const mission = await studio.run('Research', 'owner');
    assert.equal(mission.status, 'FAILED');
    assert.equal(mission.events.at(-1)?.next_state, 'BLOCKED');
    assert.equal(mission.draft, undefined);
    assert.equal(studio.active, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('simultaneous missions cannot share the office', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bej-test-'));
  try {
    const studio = new Studio(new MockProvider(), { async send() {} }, directory);
    const first = studio.run('First', 'owner');
    await assert.rejects(studio.run('Second', 'owner'), /busy/);
    await first;
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('access requires server, channel, and user; messages preserve emoji and meet limits', () => {
  const settings = { DISCORD_GUILD_ID: 'guild', DISCORD_CHANNEL_ID: 'office', DISCORD_ALLOWED_USER_IDS: ['owner'] };
  assert(authorized('guild', 'office', 'owner', settings));
  assert(!authorized('guild', 'office', 'stranger', settings));
  assert(!authorized('guild', 'public', 'owner', settings));
  assert(!authorized(null, 'office', 'owner', settings));
  const text = '🕵️ Research\n'.repeat(1000);
  const split = chunks(text);
  assert(split.every(part => part.length <= 1900));
  assert.equal(split.join(''), text);
});

test('Gemini rejects ungrounded research and validates structured responses', async () => {
  const request = (payload: object) => (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
  const ungrounded = new GeminiProvider('fake', 'test', request({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'A claim with no sources.' }] } }] }));
  await assert.rejects(ungrounded.research('topic'), /no grounded citations/);
  const invalid = new GeminiProvider('fake', 'test', request({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"research_goal":12}' }] } }] }));
  await assert.rejects(invalid.plan('topic'));
});
