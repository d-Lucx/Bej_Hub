import { readdir, readFile, stat } from 'node:fs/promises';
import { supabaseSettings } from './supabase-config.js';

// Optional server-only mirror. Failed sync never interrupts an agent workflow.
export function startSupabaseSync() {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return;
  let settings;
  try { settings = supabaseSettings(); } catch { console.error('Supabase sync disabled: check the project URL and server secret key.'); return; }
  const { url, headers } = settings;
  let busy = false;
  const synced = new Map<string, number>();
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const files = (await readdir('data/missions')).filter(name => name.endsWith('.json'));
      for (const name of files) {
        const path = `data/missions/${name}`; const modified = (await stat(path)).mtimeMs;
        if (synced.get(name) === modified) continue;
        const mission = JSON.parse(await readFile(path, 'utf8'));
        const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/sync_studio_mission`, {
          method: 'POST', headers,
          body: JSON.stringify({ p_mission: mission }), signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) { console.error(`Supabase sync failed (HTTP ${response.status}). Local records are safe; retrying later.`); break; }
        synced.set(name, modified);
      }
    } catch { console.error('Supabase sync unavailable. Local records are safe; retrying later.'); }
    finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 5000);
  void tick();
  return () => clearInterval(timer);
}
