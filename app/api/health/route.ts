export const dynamic = 'force-dynamic';
// Public liveness only: never reveal missions, credentials, identity, or usage.
export function GET() { return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } }); }
