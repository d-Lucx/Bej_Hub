import { mkdir, open, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { cloudEnabled, cloudList, cloudWrite, rpc } from './cloud-store.ts';

export const QueueInput = z.object({ prompt: z.string().trim().min(1).max(2000), sources: z.string().trim().min(1).max(6000) }).strict();
export type QueueEntry = z.infer<typeof QueueInput> & { id: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'WAITING_APPROVAL' | 'WAITING_CLARIFICATION' | 'REJECTED'; created_at: string; mission_id?: string; error?: string; action?: 'approve' | 'reject' | 'clarify'; response?: string; review_id?: string; review_key?: string };
export const ReviewInput = z.object({ id: z.uuid(), action: z.enum(['approve', 'reject', 'clarify']), response: z.string().trim().min(1).max(2000).optional(), key: z.string().regex(/^[a-f0-9]{12}$/).optional() }).strict().refine(input => input.action !== 'clarify' || !!input.response, { message: 'Provide a clarification.' });
export async function enqueueReview(input: unknown, directory = 'data/queue') {
  const review = ReviewInput.parse(input);
  const entry: QueueEntry = { id: randomUUID(), prompt: `${review.action}: ${review.id}`, sources: '', status: 'QUEUED', created_at: new Date().toISOString(), action: review.action, review_id: review.id, response: review.response, review_key: review.key };
  await mkdir(directory, { recursive: true });
  await writeQueue(join(directory, `${Date.now()}-${entry.id}.json`), entry);
  return entry;
}
export async function writeQueue(path: string, entry: QueueEntry) {
  if (cloudEnabled() && path.replaceAll('\\', '/').startsWith('data/queue/')) { await cloudWrite('queue', entry.id, entry); return; }
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(entry)); await rename(temp, path);
}
export async function enqueue(input: unknown, directory = 'data/queue') {
  const parsed = QueueInput.parse(input);
  const entry: QueueEntry = { ...parsed, id: randomUUID(), status: 'QUEUED', created_at: new Date().toISOString() };
  await mkdir(directory, { recursive: true });
  await writeQueue(join(directory, `${Date.now()}-${entry.id}.json`), entry);
  return entry;
}
// Both cancellation and the worker claim use this same cross-process lock.
// It is held only for a file read/write, never across model or Discord calls.
export async function transitionQueue(path: string, from: QueueEntry['status'], to: QueueEntry['status'], patch: Partial<QueueEntry> = {}): Promise<QueueEntry | null> {
  if (cloudEnabled() && path.replaceAll('\\', '/').startsWith('data/queue/')) {
    const id = path.match(/([a-f0-9-]{36})\.json$/)?.[1];
    if (!id || !z.uuid().safeParse(id).success) throw new Error('Invalid queue path.');
    return rpc<QueueEntry | null>('transition_studio_queue', { p_id: id, p_from: from, p_to: to, p_patch: patch });
  }
  let lock;
  try { lock = await open(`${path}.lock`, 'wx'); }
  catch (error: any) { if (error.code === 'EEXIST') return null; throw error; }
  try {
    const entry = JSON.parse(await readFile(path, 'utf8')) as QueueEntry;
    if (entry.status !== from) return null;
    const updated = { ...entry, ...patch, status: to };
    await writeQueue(path, updated);
    return updated;
  } finally { await lock.close(); await unlink(`${path}.lock`); }
}
export async function cancelQueued(id: string, directory = 'data/queue') {
  if (!z.uuid().safeParse(id).success) throw new Error('Invalid queue ID.');
  if (cloudEnabled() && directory === 'data/queue') return !!await transitionQueue(`data/queue/${id}.json`, 'QUEUED', 'CANCELLED');
  const files = await readdir(directory).catch(() => [] as string[]);
  const file = files.find(name => name.endsWith(`-${id}.json`));
  if (!file) return false;
  return !!await transitionQueue(join(directory, file), 'QUEUED', 'CANCELLED');
}
export async function listQueue(directory = 'data/queue'): Promise<{ path: string; entry: QueueEntry }[]> {
  if (cloudEnabled() && directory === 'data/queue') return (await cloudList<QueueEntry>('queue')).map(entry => ({ path: `data/queue/${entry.id}.json`, entry })).sort((a, b) => a.entry.created_at.localeCompare(b.entry.created_at));
  const files = (await readdir(directory).catch(() => [] as string[])).filter(name => name.endsWith('.json')).sort();
  const rows = await Promise.all(files.map(async file => { const path = join(directory, file); try { return { path, entry: JSON.parse(await readFile(path, 'utf8')) as QueueEntry }; } catch { return null; } }));
  return rows.filter((row): row is { path: string; entry: QueueEntry } => !!row);
}
