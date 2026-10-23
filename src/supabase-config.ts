export function supabaseSettings(env: NodeJS.ProcessEnv = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) throw new Error('SUPABASE_URL must be your HTTPS project URL.');
  if (!key.startsWith('sb_secret_') && !key.startsWith('eyJ')) throw new Error('Use a server secret key (sb_secret_...) or a legacy service_role key.');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return { url: url.replace(/\/$/, ''), headers };
}
