import { readOffice } from '../../../src/office-state.ts';
import { officeAccess } from '../../../src/web-auth.ts';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const access = await officeAccess(request);
  if (access.error) return access.error;
  try { return access.finish!(Response.json(await readOffice())); }
  catch { return access.finish!(Response.json({ error: 'Office storage is temporarily unavailable.' }, { status: 503 })); }
}
