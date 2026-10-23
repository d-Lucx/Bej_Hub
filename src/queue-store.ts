import { mkdir, open, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';

export const QueueInput = z.object({ prompt: z.string().trim().min(1).max(2000), sources: z.string().trim().min(1).max(6000) }).strict();
export type QueueEntry = z.infer<typeof QueueInput> & { id: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'WAITING_APPROVAL' | 'WAITING_CLARIFICATION' | 'REJECTED'; created_at: string; mission_id?: string; error?: string; action?: 'approve' | 'reject' | 'clarify'; response?: string; review_id?: string };
export const ReviewInput = z.object({ id: z.uuid(), action: z.enum(['approve', 'reject', 'clarify']), response: z.string().trim().min(1).max(2000).optional() }).strict().refine(input => input.action !== 'clarify' || !!input.response, { message: 'Provide a clarification.' });
export async function enqueueReview(input: unknown, directory = 'data/queue') {
  const review = ReviewInput.parse(input);
  const entry: QueueEntry = { id: randomUUID(), prompt: `${review.action}: ${review.id}`, sources: '', status: 'QUEUED', created_at: new Date().toISOString(), action: review.action, review_id: review.id, response: review.response };
  await mkdir(directory, { recursive: true });
  await writeQueue(join(directory, `${Date.now()}-${entry.id}.json`), entry);
  return entry;
}
export async function writeQueue(path: string, entry: QueueEntry) {
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
  const files = await readdir(directory).catch(() => [] as string[]);
  const file = files.find(name => name.endsWith(`-${id}.json`));
  if (!file) return false;
  return !!await transitionQueue(join(directory, file), 'QUEUED', 'CANCELLED');
}
