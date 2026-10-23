import { authPolicy } from '../../src/auth-policy';
export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let configured = false;
  try { configured = authPolicy().required; } catch { /* Fail closed with setup notice. */ }
  const { error } = await searchParams;
  return <main className="login-shell"><section className="login-card"><img src="/brand/bej-mark.svg" width="64" height="64" alt="Bej Hub" /><div className="eyebrow">YOUR PRIVATE VIRTUAL STUDIO</div><h1>A little space.<br />Just for you.</h1><p>Sign in with your authorized Google account to enter the studio.</p>{error && <p className="login-error" role="alert">{error === 'denied' ? 'This Google account is not authorized. Choose the owner account.' : 'Sign-in could not finish. Please try again.'}</p>}{configured ? <form action="/auth/signin" method="post"><button className="primary" type="submit"><span aria-hidden="true">G</span> Continue with Google</button></form> : <p role="status">{process.env.NODE_ENV === 'production' ? 'The private office is awaiting its security configuration.' : 'Google sign-in is not configured in local mode. Open the local office to continue.'}</p>}<small>Mission history and controls are available only after access is verified.</small></section></main>;
}
