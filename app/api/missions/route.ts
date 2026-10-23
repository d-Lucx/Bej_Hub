import { enqueue, QueueInput, cancelQueued } from '../../../src/queue-store';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const host = request.headers.get('host');
  if (!['localhost:3000', '127.0.0.1:3000'].includes(host ?? '') || request.headers.get('origin') !== `http://${host}`) return new Response('Local office only', { status: 403 });
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
  const host = request.headers.get('host');
  if (!['localhost:3000', '127.0.0.1:3000'].includes(host ?? '') || request.headers.get('origin') !== `http://${host}`) return Response.json({ error: 'Local office only' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const parsed = z.object({ id: z.uuid(), action: z.literal('cancel') }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Invalid cancellation request.' }, { status: 400 });
  const cancelled = await cancelQueued(parsed.data.id);
  return Response.json(cancelled ? { message: 'Queued mission cancelled.' } : { error: 'This mission has already started, changed, or was not found. Refresh and check its status.' }, { status: cancelled ? 200 : 409 });
}
