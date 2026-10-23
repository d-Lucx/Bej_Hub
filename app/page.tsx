import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Home from './office-client';
import { officeAccess } from '../src/web-auth';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const incoming = await headers();
  const access = await officeAccess(new Request('http://office/', { headers: incoming }));
  if (access.error) {
    if (access.error.status === 401) redirect('/login');
    return <main className="login-shell"><section className="login-card"><h1>Private studio</h1><p>{access.error.status === 403 ? 'This account or address is not authorized.' : 'The office is awaiting its security configuration.'}</p><a href="/login">Sign in</a></section></main>;
  }
  return <Home signedIn={!!access.email} />;
}
