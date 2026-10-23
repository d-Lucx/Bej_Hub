import { readdir, readFile } from 'node:fs/promises';
import type { Mission, Role, State } from './contracts.js';
import { readBotStatus } from './bot-status.ts';

export const team = [
  { id: 'manager' as Role, name: 'Bej Manager', role: 'Plans & coordinates', color: '#bb764c', x: 235, y: 260 },
  { id: 'researcher' as Role, name: 'Research Bot', role: 'Finds the useful details', color: '#658e72', x: 480, y: 260 },
  { id: 'writer' as Role, name: 'Writer Bot', role: 'Gives ideas a voice', color: '#7981af', x: 725, y: 260 },
];
export function projectOffice(missions: Mission[], queued: any[] = []) {
  const sorted = [...missions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = sorted[0];
  // A crashed process cannot keep an agent visibly working forever.
  const lastTime = latest?.events.at(-1)?.timestamp || latest?.created_at;
  const stale = latest?.status === 'RUNNING' && Date.now() - Date.parse(lastTime!) > 15 * 60 * 1000;
  const agents = team.map(agent => {
    const event = latest?.events.filter(event => event.agent_id === agent.id).at(-1);
    const state: State = latest?.status === 'RUNNING' && !stale ? event?.next_state ?? 'IDLE' : latest?.status === 'FAILED' && agent.id === 'manager' ? 'BLOCKED' : 'IDLE';
    return { ...agent, state, speech: stale ? 'Previous mission interrupted. Check the bot terminal.' : event?.speech_bubble || 'Ready when you are.', events: latest?.events.filter(event => event.agent_id === agent.id).map(({ payload, ...event }) => event) ?? [] };
  });
  return { agents, missions: sorted.slice(0, 20).map(({ events, brief, ...mission }) => ({ ...mission, retry_sources: mission.source_text ?? brief?.supplied_text, source_kind: brief?.source_kind, events: events.map(({ payload, ...event }) => event) })), queued, tokens: sorted.reduce((sum, mission) => sum + mission.tokens_used, 0), stale: !!stale, active: latest?.status === 'RUNNING' && !stale, sync: 'local', now: new Date().toISOString() };
}
export async function readOffice() {
  const files = await readdir('data/missions').catch(() => [] as string[]);
  const missions = await Promise.all(files.filter(name => name.endsWith('.json')).map(async name => {
    try { return JSON.parse(await readFile(`data/missions/${name}`, 'utf8')) as Mission; } catch { return null; }
  }));
  const queueFiles = await readdir('data/queue').catch(() => [] as string[]);
  const queued = await Promise.all(queueFiles.filter(name => name.endsWith('.json')).map(async name => {
    try { const entry = JSON.parse(await readFile(`data/queue/${name}`, 'utf8')); return { id: entry.id, prompt: entry.prompt, status: entry.status, error: entry.error, created_at: entry.created_at }; } catch { return null; }
  }));
  return { ...projectOffice(missions.filter((mission): mission is Mission => mission !== null), queued.filter(Boolean).sort((a, b) => b!.created_at.localeCompare(a!.created_at)).slice(0, 20)), bot: await readBotStatus() };
}
