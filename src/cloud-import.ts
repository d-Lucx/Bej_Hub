import { readdir, readFile } from 'node:fs/promises';
import { cloudRead, cloudWrite, database, rpc } from './cloud-store.js';
import { listMissions } from './mission-store.js';
import type { Mission } from './contracts.js';

async function main() {
  await database('studio_records?select=key&limit=0');
  // Explicit local path keeps the importer on disk even when cloud mode is set.
  const missions = await listMissions('./data/missions');
  let imported = 0;
  for (const mission of missions) {
    const rows = await database<{ snapshot: Mission }[]>(`missions?id=eq.${mission.id}&select=snapshot`);
    const remote = rows[0]?.snapshot;
    const updated = (value: Mission) => value.events.at(-1)?.timestamp ?? value.created_at;
    if (remote && updated(remote) >= updated(mission)) continue;
    if (['RUNNING', 'DELIVERING'].includes(mission.status)) continue;
    await rpc('sync_studio_mission', { p_mission: mission }); imported++;
  }
  for (const [directory, bucket] of [['data/queue', 'queue'], ['data/review-cards', 'reviews']] as const) {
    for (const file of await readdir(directory).catch(() => [] as string[])) {
      if (!file.endsWith('.json')) continue;
      const record = JSON.parse(await readFile(`${directory}/${file}`, 'utf8'));
      const key = bucket === 'queue' ? record.id : record.message;
      if (!key || await cloudRead(bucket, key)) continue;
      // Old queued work must never start just because history was imported.
      if (bucket === 'queue' && ['QUEUED', 'RUNNING'].includes(record.status)) { record.status = 'EXPIRED'; record.error = 'Imported history only. Review and submit again if needed.'; }
      await cloudWrite(bucket, key, record);
    }
  }
  console.log(`Import complete: ${imported} local missions added or updated. Newer remote records were preserved; no missions were executed.`);
}
main().catch(() => { console.error('Import stopped. Check Supabase credentials and run schema.sql plus cloud.sql first. Local files remain safe.'); process.exitCode = 1; });
