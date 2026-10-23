import { readOffice } from '../../../src/office-state';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!['localhost:3000', '127.0.0.1:3000'].includes(request.headers.get('host') ?? '')) return new Response('Local office only', { status: 403 });
  return Response.json(await readOffice(), { headers: { 'Cache-Control': 'no-store' } });
}
