import { readdir, readFile } from 'node:fs/promises';
import { supabaseSettings } from './supabase-config.js';
import type { Mission } from './contracts.js';

async function main() {
  const settings = supabaseSettings();
  const files = (await readdir('data/missions')).filter(name => name.endsWith('.json'));
  const records = await Promise.all(files.map(async name => {
    try { return JSON.parse(await readFile(`data/missions/${name}`, 'utf8')) as Mission; }
    catch { return null; }
  }));
  const mission = records.filter((record): record is Mission => record?.status === 'COMPLETED' && record.mode === 'mock')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!mission) throw new Error('No completed mock mission is available. Run bej.cmd demo first.');
  console.log(`Verifying Supabase mirroring with completed mock mission ${mission.id}.`);
  const rpc = async () => {
    const response = await fetch(`${settings.url}/rest/v1/rpc/sync_studio_mission`, {
      method: 'POST', headers: settings.headers,
      body: JSON.stringify({ p_mission: mission }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const code = typeof body.code === 'string' && /^[A-Z0-9_]+$/.test(body.code) ? ` / ${body.code}` : '';
      throw new Error(`Sync function failed (HTTP ${response.status}${code}). Check supabase/schema.sql and function permissions.`);
    }
  };
  const read = async (query: string) => {
    const response = await fetch(`${settings.url}/rest/v1/${query}`, { headers: settings.headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Read-back failed (HTTP ${response.status}).`);
    return response.json();
  };
  await rpc();
  const rows = await read(`missions?id=eq.${mission.id}&select=id,status,tokens_used`);
  if (rows.length !== 1 || rows[0].status !== mission.status || Number(rows[0].tokens_used) !== mission.tokens_used) throw new Error('Saved mission does not match the local record.');
  console.log('OK: mission written and read back with matching status and token count.');
  const logs = await read(`agent_logs?mission_id=eq.${mission.id}&select=event_index,agent_id&order=event_index.asc`);
  if (logs.length !== mission.events.length || logs.some((row: any, index: number) => row.agent_id !== mission.events[index].agent_id)) throw new Error('Saved event log does not match the local mission.');
  console.log(`OK: all ${logs.length} progress events mirrored.`);
  await rpc();
  const repeated = await read(`agent_logs?mission_id=eq.${mission.id}&select=event_index`);
  if (repeated.length !== logs.length) throw new Error('Repeating sync duplicated progress events.');
  console.log('OK: repeated sync did not duplicate progress events.');
  const agents = await read('agents?select=id');
  const ids = new Set(agents.map((agent: any) => agent.id));
  if (!['manager', 'researcher', 'writer'].every(id => ids.has(id))) throw new Error('An agent record is missing.');
  console.log('OK: all three agent records exist.');
  console.log('Supabase write/read verification passed. This existing mock mission remains mirrored in your project.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Sync verification failed.'); process.exitCode = 1; });
