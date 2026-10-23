import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREAK_SPOTS, DESK_POSITIONS, findOfficePath, HandoffInbox, stepPath, walkable, type Handoff, type Point } from '../src/office-motion.js';
import { projectOffice } from '../src/office-state.js';
import type { Mission } from '../src/contracts.js';

function clearRoute(path: Point[]) {
  assert(path.length > 0);
  for (let i = 0; i < path.length; i++) {
    assert(walkable(path[i]), `Blocked waypoint ${JSON.stringify(path[i])}`);
    if (i === 0) continue;
    const a = path[i - 1]; const b = path[i];
    const samples = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let n = 0; n <= samples; n++) assert(walkable({ x: a.x + (b.x - a.x) * n / samples, y: a.y + (b.y - a.y) * n / samples }), 'A segment crosses furniture');
  }
}
test('all desk handoffs and idle coffee trips have clear outbound and return paths', () => {
  for (const home of Object.values(DESK_POSITIONS)) {
    for (const other of Object.values(DESK_POSITIONS)) {
      if (home === other) continue;
      const target = { x: other.x + (home.x < other.x ? -48 : 48), y: other.y };
      const path = findOfficePath(home, target); clearRoute(path); clearRoute(findOfficePath(target, home));
      assert.deepEqual(path[0], home); assert.deepEqual(path.at(-1), target);
    }
    for (const spot of BREAK_SPOTS) { clearRoute(findOfficePath(home, spot)); clearRoute(findOfficePath(spot, home)); }
  }
});
test('blocked and outside-room destinations do not fall back to walking through objects', () => {
  assert.deepEqual(findOfficePath(DESK_POSITIONS.manager, { x: 235, y: 260 }), []);
  assert.deepEqual(findOfficePath(DESK_POSITIONS.manager, { x: 20, y: 100 }), []);
  assert.deepEqual(findOfficePath({ x: 230, y: 450 }, DESK_POSITIONS.writer), []);
});
test('movement follows waypoints and never overshoots the final destination', () => {
  const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  const first = stepPath({ x: 0, y: 0 }, path, 0, 15);
  assert.deepEqual(first.point, { x: 10, y: 5 }); assert.equal(first.done, false);
  const last = stepPath(first.point, path, first.index, 100);
  assert.deepEqual(last.point, { x: 10, y: 10 }); assert.equal(last.done, true);
});
test('polling seeds history, deduplicates handoffs, and ignores stale backlog', () => {
  const now = Date.now();
  const event = (key: string, age = 0): Handoff => ({ key, mission_id: 'mission', agent_id: 'manager', target_agent: 'researcher', timestamp: new Date(now - age).toISOString() });
  const inbox = new HandoffInbox();
  assert.deepEqual(inbox.ingest([], false, now), []);
  assert.deepEqual(inbox.ingest([event('history')], true, now), []);
  assert.deepEqual(inbox.ingest([event('history'), event('fresh')], true, now).map(item => item.key), ['fresh']);
  assert.deepEqual(inbox.ingest([event('fresh')], true, now), []);
  assert.deepEqual(inbox.ingest([event('stale', 60000)], true, now), []);
});
test('office exposes stable handoff IDs without private payloads', () => {
  const mission: Mission = { id: 'mission', prompt: 'Test', created_by: 'owner', mode: 'mock', status: 'COMPLETED', tokens_used: 0, created_at: new Date().toISOString(), events: [{ version: 1, mission_id: 'mission', agent_id: 'manager', next_state: 'HANDOFF', target_agent: 'researcher', timestamp: new Date().toISOString(), speech_bubble: 'Sending', payload: { private: 'reference data' } }] };
  const handoffs = projectOffice([mission]).handoffs;
  assert.equal(handoffs[0].key, 'mission:0'); assert.equal(handoffs[0].target_agent, 'researcher'); assert(!('payload' in handoffs[0]));
});
