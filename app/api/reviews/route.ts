import { readFile } from 'node:fs/promises';
import { enqueueReview, ReviewInput } from '../../../src/queue-store.ts';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const host = request.headers.get('host');
  if (!['localhost:3000', '127.0.0.1:3000'].includes(host ?? '') || request.headers.get('origin') !== `http://${host}`) return Response.json({ error: 'Local office only' }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 5000) return Response.json({ error: 'Review response is too long.' }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const parsed = ReviewInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Choose a valid review action and provide a clarification if needed.' }, { status: 400 });
  let mission;
  try { mission = JSON.parse(await readFile(`data/missions/${parsed.data.id}.json`, 'utf8')); } catch { return Response.json({ error: 'Mission not found.' }, { status: 404 }); }
  if (!['WAITING_APPROVAL', 'WAITING_CLARIFICATION'].includes(mission.status) || parsed.data.action === 'approve' && mission.status !== 'WAITING_APPROVAL' || parsed.data.action === 'clarify' && mission.status !== 'WAITING_CLARIFICATION') return Response.json({ error: 'The mission state has changed. Refresh and review it again.' }, { status: 409 });
  const entry = await enqueueReview(parsed.data);
  return Response.json({ id: entry.id, message: 'Review response queued. The bot will apply it when available.' }, { status: 202 });
}
