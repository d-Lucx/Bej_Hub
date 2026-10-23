import type { Mission, Role, State } from './contracts.ts';
import { readBotStatus } from './bot-status.ts';
import { listMissions } from './mission-store.ts';
import { listQueue } from './queue-store.ts';
import { cloudEnabled } from './cloud-store.ts';
import { reviewKey } from './review-state.ts';

export const team = [
  { id: 'manager' as Role, name: 'Bej Manager', role: 'Plans & coordinates', color: '#bb764c', x: 235, y: 260 },
  { id: 'researcher' as Role, name: 'Research Bot', role: 'Finds the useful details', color: '#658e72', x: 480, y: 260 },
  { id: 'writer' as Role, name: 'Writer Bot', role: 'Gives ideas a voice', color: '#7981af', x: 725, y: 260 },
];
export function projectOffice(missions: Mission[], queued: any[] = []) {
  const sorted = [...missions].sort((a, b) => (b.events.at(-1)?.timestamp ?? b.created_at).localeCompare(a.events.at(-1)?.timestamp ?? a.created_at));
  const latest = sorted[0];
  // A crashed process cannot keep an agent visibly working forever.
  const lastTime = latest?.events.at(-1)?.timestamp || latest?.created_at;
  const stale = latest?.status === 'RUNNING' && Date.now() - Date.parse(lastTime!) > 15 * 60 * 1000;
  const agents = team.map(agent => {
    const event = latest?.events.filter(event => event.agent_id === agent.id).at(-1);
    const pending = latest?.status === 'WAITING_APPROVAL' && agent.id === 'writer' ? 'WAITING_APPROVAL' : latest?.status === 'WAITING_CLARIFICATION' && agent.id === 'researcher' ? 'WAITING_CLARIFICATION' : undefined;
    const state: State = pending ?? (latest?.status === 'RUNNING' && !stale ? event?.next_state ?? 'IDLE' : latest?.status === 'FAILED' && agent.id === 'manager' ? 'BLOCKED' : 'IDLE');
    return { ...agent, state, speech: stale ? 'Previous mission interrupted. Check the bot terminal.' : event?.speech_bubble || 'Ready when you are.', events: latest?.events.filter(event => event.agent_id === agent.id).map(({ payload, ...event }) => event) ?? [] };
  });
  const summary = ({ events, brief, ...mission }: Mission) => ({ ...mission, review_key: reviewKey({ ...mission, events, brief }), clarification_question: brief?.clarification_question, retry_sources: mission.source_text ?? brief?.supplied_text, source_kind: brief?.source_kind, events: events.map(({ payload, ...event }) => event) });
  const handoffs = sorted.flatMap(mission => mission.events.flatMap((event, index) => event.next_state === 'HANDOFF' && event.target_agent ? [{ key: `${mission.id}:${index}`, mission_id: mission.id, agent_id: event.agent_id, target_agent: event.target_agent, timestamp: event.timestamp }] : [])).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-100);
  return { agents, handoffs, missions: sorted.slice(0, 20).map(summary), pending: sorted.filter(mission => mission.status === 'WAITING_APPROVAL' || mission.status === 'WAITING_CLARIFICATION').map(summary), queued, tokens: sorted.reduce((sum, mission) => sum + mission.tokens_used, 0), stale: !!stale, active: latest?.status === 'RUNNING' && !stale, sync: 'local', now: new Date().toISOString() };
}
export async function readOffice() {
  const [missions, rows, bot] = await Promise.all([listMissions(), listQueue(), readBotStatus()]);
  const queued = rows.map(({ entry }) => { const linked = missions.find(mission => mission.id === entry.mission_id); return { id: entry.id, prompt: entry.prompt, status: linked && ['WAITING_APPROVAL', 'WAITING_CLARIFICATION'].includes(entry.status) ? linked.status : entry.status, error: entry.error, created_at: entry.created_at, review_id: entry.review_id, action: entry.action }; });
  return { ...projectOffice(missions, queued.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20)), sync: cloudEnabled() ? 'supabase' : 'local', bot };
}
