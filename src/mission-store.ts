import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Mission } from './contracts.ts';
import { allRows, cloudEnabled, database, rpc } from './cloud-store.ts';

export async function readMission(id: string, directory = 'data/missions'): Promise<Mission> {
  if (!z.uuid().safeParse(id).success) throw new Error('Invalid mission ID.');
  if (cloudEnabled() && directory === 'data/missions') {
    const rows = await database<{ snapshot: Mission }[]>(`missions?id=eq.${id}&select=snapshot`);
    if (!rows[0]) throw new Error('Mission not found.');
    return rows[0].snapshot;
  }
  return JSON.parse(await readFile(join(directory, `${id}.json`), 'utf8'));
}
export async function saveMission(mission: Mission, directory = 'data/missions') {
  if (cloudEnabled() && directory === 'data/missions') { await rpc('sync_studio_mission', { p_mission: mission }); return; }
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${mission.id}.json`); const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(mission, null, 2)); await rename(temp, path);
}
export async function listMissions(directory = 'data/missions'): Promise<Mission[]> {
  if (cloudEnabled() && directory === 'data/missions') return (await allRows<{ snapshot: Mission }>('missions?select=snapshot&order=id.asc')).map(row => row.snapshot);
  const files = await readdir(directory).catch(() => [] as string[]);
  const rows = await Promise.all(files.filter(file => file.endsWith('.json')).map(file => readMission(file.slice(0, -5), directory).catch(() => null)));
  return rows.filter((row): row is Mission => !!row);
}
