import { authContext } from '../../../src/web-auth';
import { ownerAllowed, trustedRequest } from '../../../src/auth-policy';
export async function GET(request: Request) {
  try {
    const auth = authContext(request);
    if (!auth.client || !trustedRequest(request, auth.policy)) return new Response('Sign-in unavailable.', { status: 403 });
    const redirect = (path: string) => auth.finish(new Response(null, { status: 303, headers: { Location: `${auth.policy.origin}${path}` } }));
    const code = new URL(request.url).searchParams.get('code');
    if (!code || code.length > 2048) return redirect('/login?error=signin');
    const { error } = await auth.client.auth.exchangeCodeForSession(code);
    if (error) return redirect('/login?error=signin');
    const { data } = await auth.client.auth.getUser();
    if (!ownerAllowed(data.user, auth.policy.owner)) {
      await auth.client.auth.signOut({ scope: 'local' });
      return redirect('/login?error=denied');
    }
    return redirect('/');
  } catch { return new Response('Sign-in could not be verified. Please try again.', { status: 503 }); }
}
