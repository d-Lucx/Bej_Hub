import { enqueue, QueueInput, cancelQueued } from '../../../src/queue-store.ts';
import { z } from 'zod';
import { officeAccess } from '../../../src/web-auth.ts';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const access = await officeAccess(request, true);
  if (access.error) return access.error;
  try { return access.finish!(await createMission(request)); }
  catch { return access.finish!(Response.json({ error: 'Mission storage is temporarily unavailable.' }, { status: 503 })); }
}
async function createMission(request: Request) {
  const raw = await request.text();
  if (raw.length > 16000) return Response.json({ error: 'Mission is too long.' }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const parsed = QueueInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Add a mission (up to 2000 characters) and source text (up to 6000 characters).' }, { status: 400 });
  const entry = await enqueue(parsed.data);
  return Response.json({ id: entry.id, message: 'Mission queued. Keep the Discord bot running to start it.' }, { status: 202 });
}
export async function PATCH(request: Request) {
  const access = await officeAccess(request, true);
  if (access.error) return access.error;
  try { return access.finish!(await cancelMission(request)); }
  catch { return access.finish!(Response.json({ error: 'Queue storage is temporarily unavailable.' }, { status: 503 })); }
}
async function cancelMission(request: Request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const parsed = z.object({ id: z.uuid(), action: z.literal('cancel') }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Invalid cancellation request.' }, { status: 400 });
  const cancelled = await cancelQueued(parsed.data.id);
  return Response.json(cancelled ? { message: 'Queued mission cancelled.' } : { error: 'This mission has already started, changed, or was not found. Refresh and check its status.' }, { status: cancelled ? 200 : 409 });
}
