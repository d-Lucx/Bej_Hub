import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type BotStatus = { online: boolean; version?: string; mode?: string; model?: string; researchMode?: string; activeMission?: string; updatedAt?: string };
export function parseBotStatus(value: any, now = Date.now()): BotStatus {
  const updated = Date.parse(value?.updatedAt);
  if (!Number.isFinite(updated) || now - updated > 15000 || updated > now + 5000) return { online: false };
  return { online: value.online === true, version: value.version, mode: value.mode, model: value.model, researchMode: value.researchMode, activeMission: value.activeMission, updatedAt: value.updatedAt };
}
export async function readBotStatus(directory = 'data'): Promise<BotStatus> {
  try { return parseBotStatus(JSON.parse(await readFile(join(directory, 'bot-status.json'), 'utf8'))); }
  catch { return { online: false }; }
}
export function startBotStatus(snapshot: () => Omit<BotStatus, 'updatedAt'>, directory = 'data') {
  let busy = false;
  const publish = async () => {
    if (busy) return;
    busy = true;
    try {
      await mkdir(directory, { recursive: true });
      const path = join(directory, 'bot-status.json');
      const temp = `${path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify({ ...snapshot(), updatedAt: new Date().toISOString() }));
      await rename(temp, path);
    } catch { console.error('Could not update local bot status.'); }
    finally { busy = false; }
  };
  void publish();
  const timer = setInterval(() => { void publish(); }, 3000);
  return () => clearInterval(timer);
}
