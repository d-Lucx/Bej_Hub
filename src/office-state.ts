import { readdir, readFile } from 'node:fs/promises';
import type { Mission, Role, State } from './contracts.js';
import { readBotStatus } from './bot-status.ts';

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
  const summary = ({ events, brief, ...mission }: Mission) => ({ ...mission, clarification_question: brief?.clarification_question, retry_sources: mission.source_text ?? brief?.supplied_text, source_kind: brief?.source_kind, events: events.map(({ payload, ...event }) => event) });
  return { agents, missions: sorted.slice(0, 20).map(summary), pending: sorted.filter(mission => mission.status === 'WAITING_APPROVAL' || mission.status === 'WAITING_CLARIFICATION').map(summary), queued, tokens: sorted.reduce((sum, mission) => sum + mission.tokens_used, 0), stale: !!stale, active: latest?.status === 'RUNNING' && !stale, sync: 'local', now: new Date().toISOString() };
}
export async function readOffice() {
  const files = await readdir('data/missions').catch(() => [] as string[]);
  const missions = await Promise.all(files.filter(name => name.endsWith('.json')).map(async name => {
    try { return JSON.parse(await readFile(`data/missions/${name}`, 'utf8')) as Mission; } catch { return null; }
  }));
  const queueFiles = await readdir('data/queue').catch(() => [] as string[]);
  const queued = await Promise.all(queueFiles.filter(name => name.endsWith('.json')).map(async name => {
    try { const entry = JSON.parse(await readFile(`data/queue/${name}`, 'utf8')); const linked = missions.find(mission => mission?.id === entry.mission_id); return { id: entry.id, prompt: entry.prompt, status: linked && ['WAITING_APPROVAL', 'WAITING_CLARIFICATION'].includes(entry.status) ? linked.status : entry.status, error: entry.error, created_at: entry.created_at, review_id: entry.review_id, action: entry.action }; } catch { return null; }
  }));
  return { ...projectOffice(missions.filter((mission): mission is Mission => mission !== null), queued.filter(Boolean).sort((a, b) => b!.created_at.localeCompare(a!.created_at)).slice(0, 20)), bot: await readBotStatus() };
}
