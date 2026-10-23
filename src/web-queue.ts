import { mkdir, readdir, readFile } from 'node:fs/promises';
import type { Studio } from './studio.js';
import { transitionQueue, type QueueEntry } from './queue-store.js';

export function startWebQueue(studio: Studio) {
  let reading = false;
  const tick = async () => {
    if (reading || studio.busy) return;
    reading = true;
    try {
      await mkdir('data/queue', { recursive: true });
      const files = (await readdir('data/queue')).filter(file => file.endsWith('.json')).sort();
      for (const file of files) {
        if (studio.busy) break;
        const path = `data/queue/${file}`;
        let entry: QueueEntry;
        try { entry = JSON.parse(await readFile(path, 'utf8')); } catch { continue; }
        if (entry.status !== 'QUEUED') continue;
        if (Date.now() - Date.parse(entry.created_at) > 60 * 60 * 1000) {
          await transitionQueue(path, 'QUEUED', 'EXPIRED', { error: 'This request waited over an hour. Submit it again if still needed.' });
        } else {
          const claimed = await transitionQueue(path, 'QUEUED', 'RUNNING');
          if (!claimed) continue;
          // Discord can reserve the studio while the file claim is awaiting IO.
          if (studio.busy) { await transitionQueue(path, 'RUNNING', 'QUEUED'); break; }
          try {
            const mission = entry.action && entry.review_id ? await studio.respond(entry.review_id, entry.action, 'local-office', entry.response) : await studio.run(entry.prompt, 'local-office', entry.sources);
            const status = mission.status === 'DELIVERING' ? 'FAILED' : mission.status;
            await transitionQueue(path, 'RUNNING', status, { mission_id: mission.id, error: mission.status === 'FAILED' ? 'Mission failed. Open Mission history for details.' : undefined });
          } catch { await transitionQueue(path, 'RUNNING', 'FAILED', { error: 'Could not run this request. Check the bot terminal.' }); }
        }
        break;
      }
    } catch { console.error('Office queue could not be read. Check local data permissions.'); }
    finally { reading = false; }
  };
  const timer = setInterval(() => { void tick(); }, 1500);
  return () => clearInterval(timer);
}
