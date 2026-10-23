import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveMission, readMission } from '../src/mission-store.js';
import { enqueue, transitionQueue } from '../src/queue-store.js';
import { Studio } from '../src/studio.js';
import { MockProvider } from '../src/providers.js';
import { reviewKey } from '../src/review-state.js';
import type { Mission } from '../src/contracts.js';

test('cloud storage persists a mission, atomically claims work, and rejects duplicate review delivery', async () => {
  const savedEnv = { ...process.env }; const originalFetch = globalThis.fetch;
  const missions = new Map<string, Mission>(); const queue = new Map<string, any>();
  const id = 'c4ae0e1a-e180-4f68-b3ae-2c3dba75a649';
  try {
    Object.assign(process.env, { BEJ_STORAGE: 'supabase', SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_testing' });
    globalThis.fetch = (async (input, init) => {
      const url = String(input); const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (url.endsWith('/rpc/sync_studio_mission')) { missions.set(body.p_mission.id, structuredClone(body.p_mission)); return Response.json(null); }
      if (url.includes('/missions?')) return Response.json(missions.has(id) ? [{ snapshot: missions.get(id) }] : []);
      if (url.includes('/studio_records?') && init?.method === 'POST') { queue.set(body.key, body.document); return new Response(null, { status: 204 }); }
      if (url.endsWith('/rpc/transition_studio_queue')) { const entry = queue.get(body.p_id); if (!entry || entry.status !== body.p_from) return Response.json(null); const next = { ...entry, ...body.p_patch, status: body.p_to }; queue.set(body.p_id, next); return Response.json(next); }
      if (url.endsWith('/rpc/claim_studio_review')) { const mission = missions.get(body.p_id); if (!mission || JSON.stringify(mission) !== JSON.stringify(body.p_expected) || !['WAITING_APPROVAL','WAITING_CLARIFICATION'].includes(mission.status)) return Response.json(false); missions.set(body.p_id, { ...mission, status: body.p_next }); return Response.json(true); }
      throw new Error('Unexpected database operation');
    }) as typeof fetch;
    const mission = { id, prompt: 'Welcome', created_by: 'owner', created_at: new Date().toISOString(), mode: 'mock', status: 'WAITING_APPROVAL', tokens_used: 0, events: [], draft: { title: 'Welcome', body: 'Hello' }, brief: { text: 'Facts', sources: [], grounding: {}, mock: true } } as Mission;
    await saveMission(mission); assert.deepEqual(await readMission(id), mission);
    const queued = await enqueue({ prompt: 'Welcome', sources: 'Notes' });
    const path = `data/queue/${queued.id}.json`;
    const claims = await Promise.all([transitionQueue(path, 'QUEUED', 'RUNNING'), transitionQueue(path, 'QUEUED', 'CANCELLED')]);
    assert.equal(claims.filter(Boolean).length, 1);
    const sent: string[] = [];
    const studio = new Studio(new MockProvider(), { async send(_role, text) { sent.push(text); } }, 'data/missions', 'supplied', true);
    const key = reviewKey(mission);
    assert.equal((await studio.respond(id, 'approve', 'owner', undefined, key)).status, 'COMPLETED');
    await assert.rejects(studio.respond(id, 'approve', 'owner', undefined, key), /no longer matches/);
    assert.equal(sent.filter(text => text.startsWith('DRAFT')).length, 1);
    // A database outage must not silently write a local substitute.
    globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
    await assert.rejects(saveMission(mission), /HTTP 503/);
  } finally { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]; Object.assign(process.env, savedEnv); }
});
