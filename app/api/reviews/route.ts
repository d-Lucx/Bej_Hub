import { readMission } from '../../../src/mission-store.ts';
import { officeAccess } from '../../../src/web-auth.ts';
import { currentReview } from '../../../src/review-state.ts';
import { enqueueReview, ReviewInput } from '../../../src/queue-store.ts';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const access = await officeAccess(request, true);
  if (access.error) return access.error;
  try { return access.finish!(await review(request)); }
  catch { return access.finish!(Response.json({ error: 'Review storage is temporarily unavailable.' }, { status: 503 })); }
}
async function review(request: Request) {
  const raw = await request.text();
  if (raw.length > 5000) return Response.json({ error: 'Review response is too long.' }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const parsed = ReviewInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Choose a valid review action and provide a clarification if needed.' }, { status: 400 });
  let mission;
  try { mission = await readMission(parsed.data.id); } catch { return Response.json({ error: 'Mission not found or storage unavailable.' }, { status: 404 }); }
  if (!currentReview(mission, parsed.data.action, parsed.data.key)) return Response.json({ error: 'The mission state has changed. Refresh and review it again.' }, { status: 409 });
  const entry = await enqueueReview(parsed.data);
  return Response.json({ id: entry.id, message: 'Review response queued. The bot will apply it when available.' }, { status: 202 });
}
