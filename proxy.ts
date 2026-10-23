import { NextResponse, type NextRequest } from 'next/server';
import { officeAccess } from './src/web-auth';

// Refresh cookies before the server page renders. APIs authorize independently.
export async function proxy(request: NextRequest) {
  const access = await officeAccess(request);
  if (access.error) {
    if (access.error.status === 401 && 'finish' in access) return access.finish(NextResponse.redirect(new URL('/login', access.policy.origin)));
    return access.error;
  }
  const headers = new Headers(request.headers);
  headers.set('cookie', access.requestCookies!());
  return access.finish!(NextResponse.next({ request: { headers } }));
}
export const config = { matcher: ['/'] };
