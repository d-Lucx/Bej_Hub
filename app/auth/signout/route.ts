import { officeAccess } from '../../../src/web-auth';
export async function POST(request: Request) {
  const access = await officeAccess(request, true);
  if (access.error) return access.error;
  if (access.client) {
    const { error } = await access.client.auth.signOut({ scope: 'local' });
    if (error) return access.finish!(Response.json({ error: 'Sign-out could not finish. Please try again.' }, { status: 503 }));
  }
  return access.finish!(new Response(null, { status: 303, headers: { Location: '/login' } }));
}
