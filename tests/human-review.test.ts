import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Studio } from '../src/studio.js';
import { MockProvider, GeminiProvider } from '../src/providers.js';
import type { Brief, Mission, Result } from '../src/contracts.js';
import { projectOffice } from '../src/office-state.js';
import { ReviewInput } from '../src/queue-store.js';
import { reviewMessage, reviewKey, currentReview, closedReviewMessage } from '../src/discord-review.js';

async function workspace(fn: (directory: string) => Promise<void>) {
  const root = resolve('data/test-workspaces'); await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, 'review-'));
  try { await fn(directory); } finally { assert(directory.startsWith(root + '\\') || directory.startsWith(root + '/')); await rm(directory, { recursive: true, force: true }); }
}
test('conflicting sources pause before Writer; clarification resumes the same mission after restart', async () => {
  await workspace(async directory => {
    let writes = 0;
    class ConflictProvider extends MockProvider {
      async research(goal: string, sourceText?: string): Promise<Result<Brief>> {
        const base = await super.research(goal, sourceText);
        return { ...base, value: { ...base.value, alignment: goal.includes('Human clarification') ? 'supported' : 'conflict', clarification_question: 'The source describes a reading app. Should I focus on that app?' } };
      }
      async write(goal: string, brief: Brief) { writes++; return super.write(goal, brief); }
    }
    const provider = new ConflictProvider(); const delivered: string[] = [];
    const messenger = { async send(_role: string, text: string) { if (text.startsWith('DRAFT')) delivered.push(text); } };
    const first = new Studio(provider, messenger, directory, 'supplied', true);
    const mission = await first.run('Describe this film festival', 'owner', 'Sinag Filipino is a reading app.');
    assert.equal(mission.status, 'WAITING_CLARIFICATION'); assert.equal(writes, 0); assert.equal(first.active, undefined);
    assert.equal(mission.draft, undefined);
    assert.equal(projectOffice([mission]).pending[0].id, mission.id);
    await assert.rejects(first.respond(mission.id, 'approve', 'owner'), /no longer matches/);
    const restarted = new Studio(provider, messenger, directory, 'supplied', true);
    const resumed = await restarted.respond(mission.id, 'clarify', 'owner', 'Focus on the reading app in the supplied source.');
    assert.equal(resumed.id, mission.id); assert.equal(resumed.status, 'WAITING_APPROVAL'); assert.equal(writes, 1); assert.equal(delivered.length, 0);
    const complete = await restarted.respond(mission.id, 'approve', 'owner');
    assert.equal(complete.status, 'COMPLETED'); assert.equal(delivered.length, 1); assert.equal(writes, 1);
    assert.equal(complete.reviewed_by, 'owner');
    await assert.rejects(restarted.respond(mission.id, 'approve', 'owner'), /no longer matches/);
    assert.equal(delivered.length, 1);
  });
});
test('approval survives restart, rejects double clicks, and calls no model during delivery', async () => {
  await workspace(async directory => {
    const provider = new MockProvider(); const sent: string[] = [];
    const messenger = { async send(_role: string, text: string) { sent.push(text); } };
    const studio = new Studio(provider, messenger, directory, 'supplied', true);
    const mission = await studio.run('Welcome', 'owner', 'Project notes.');
    assert.equal(mission.status, 'WAITING_APPROVAL'); assert(!sent.some(text => text.startsWith('DRAFT')));
    const blockedProvider = new MockProvider(); blockedProvider.plan = async () => { throw new Error('Must not call AI on approval'); };
    const restarted = new Studio(blockedProvider, messenger, directory, 'supplied', true);
    const results = await Promise.allSettled([restarted.respond(mission.id, 'approve', 'owner'), restarted.respond(mission.id, 'approve', 'owner')]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(sent.filter(text => text.startsWith('DRAFT')).length, 1);
    assert.equal(JSON.parse(await readFile(join(directory, `${mission.id}.json`), 'utf8')).status, 'COMPLETED');
  });
});
test('clarification does not reattach a discarded premise to the resolved research goal', async () => {
  await workspace(async directory => {
    const goals: string[] = [];
    class ResolvedProvider extends MockProvider {
      async plan(prompt: string) {
        return { value: { research_goal: prompt.includes('Human clarification') ? 'Describe the educational reading app for parents.' : 'Describe this film festival.', writing_goal: 'Write a friendly introduction for parents.' }, tokens: 0 };
      }
      async research(goal: string, sourceText?: string): Promise<Result<Brief>> {
        goals.push(goal);
        const base = await super.research(goal, sourceText);
        return { ...base, value: { ...base.value, alignment: goal.includes('film festival') ? 'conflict' : 'supported', clarification_question: 'Did you mean the reading app?' } };
      }
    }
    const studio = new Studio(new ResolvedProvider(), { async send() {} }, directory, 'supplied', true);
    const original = await studio.run('Describe this film festival.', 'owner', 'An educational reading app.');
    assert.equal(original.status, 'WAITING_CLARIFICATION');
    const resumed = await studio.respond(original.id, 'clarify', 'owner', 'Focus on the educational reading app for parents.');
    assert.equal(resumed.status, 'WAITING_APPROVAL');
    assert.equal(goals.length, 2);
    assert.equal(goals[1], 'Describe the educational reading app for parents.');
    assert(!goals[1].includes('film festival'));
  });
});
test('reject never delivers a draft and a failed notification keeps review pending', async () => {
  await workspace(async directory => {
    const sent: string[] = [];
    const studio = new Studio(new MockProvider(), { async send(_role, text) { sent.push(text); }, async requestReview() { throw new Error('Discord is offline'); } }, directory, 'supplied', true);
    const mission = await studio.run('Welcome', 'owner', 'Notes'); assert.equal(mission.status, 'WAITING_APPROVAL');
    const rejected = await studio.respond(mission.id, 'reject', 'owner'); assert.equal(rejected.status, 'REJECTED');
    assert(!sent.some(text => text.startsWith('DRAFT')));
    await assert.rejects(studio.respond(mission.id, 'approve', 'owner'), /no longer matches/);
  });
});
test('Gemini requires alignment information and a question for conflicting sources', async () => {
  const request = (data: any) => (async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(data) }] } }] }))) as typeof fetch;
  const provider = new GeminiProvider('fake', 'test', request({ brief: 'It is an app [S1]', alignment: 'conflict', clarification_question: 'Did you mean the app?' }));
  assert.equal((await provider.research('Film festival', 'An app')).value.alignment, 'conflict');
  const invalid = new GeminiProvider('fake', 'test', request({ brief: 'It is an app', alignment: 'conflict', clarification_question: '' }));
  await assert.rejects(invalid.research('Film festival', 'An app'), /without a clarification question/);
  assert.equal(ReviewInput.safeParse({ id: 'invalid', action: 'approve' }).success, false);
});
test('Discord review cards encode the intended mission and action', () => {
  const mission = { id: 'c4ae0e1a-e180-4f68-b3ae-2c3dba75a649', mode: 'mock', status: 'WAITING_APPROVAL', draft: { title: 'Welcome', body: 'Hello' } } as Mission;
  const message = reviewMessage(mission);
  const approve = message.components[0].components[0].data;
  const reject = message.components[0].components[1].data;
  assert('custom_id' in approve); assert('custom_id' in reject);
  assert.equal(approve.custom_id, `bej:approve:${mission.id}:${reviewKey(mission)}`);
  assert.equal(reject.custom_id, `bej:reject:${mission.id}:${reviewKey(mission)}`);
});
test('resolved and superseded review cards cannot act on a newer review turn', () => {
  const mission = { id: 'c4ae0e1a-e180-4f68-b3ae-2c3dba75a649', mode: 'mock', status: 'WAITING_CLARIFICATION', prompt: 'Test', created_by: 'owner', tokens_used: 0, created_at: '2026-10-23', events: [], clarifications: [] } as Mission;
  const oldKey = reviewKey(mission);
  assert(currentReview(mission, 'clarify', oldKey));
  mission.clarifications = ['Clarify the app.'];
  assert(!currentReview(mission, 'clarify', oldKey));
  assert(!currentReview(mission, 'reject', oldKey));
  mission.status = 'COMPLETED';
  assert(!currentReview(mission, 'approve'));
  assert.deepEqual(closedReviewMessage(mission).components, []);
  assert.match(closedReviewMessage(mission).content, /completed/);
});
