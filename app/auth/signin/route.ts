import { authContext } from '../../../src/web-auth';
import { trustedRequest } from '../../../src/auth-policy';
export async function POST(request: Request) {
  try {
    const auth = authContext(request);
    if (!auth.client || !trustedRequest(request, auth.policy, true)) return new Response('Sign-in unavailable.', { status: 403 });
    const { data, error } = await auth.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${auth.policy.origin}/auth/callback`, queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true } });
    if (error || !data.url) return auth.finish(new Response(null, { status: 303, headers: { Location: `${auth.policy.origin}/login?error=signin` } }));
    // Convert the immutable redirect Response so refreshed cookies can be set.
    return auth.finish(new Response(null, { status: 303, headers: { Location: data.url } }));
  } catch { return new Response('Sign-in is not configured.', { status: 503 }); }
}
