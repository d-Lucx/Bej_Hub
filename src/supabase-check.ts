import { supabaseSettings } from './supabase-config.js';
async function main() {
  let settings;
  try { settings = supabaseSettings(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Invalid Supabase settings.'); process.exitCode = 1; return; }
  let failed = false;
  for (const table of ['agents', 'missions', 'agent_logs']) {
    const response = await fetch(`${settings.url}/rest/v1/${table}?select=*&limit=0`, { headers: settings.headers, signal: AbortSignal.timeout(15000) });
    if (response.ok) console.log(`OK: ${table} is accessible.`);
    else { failed = true; console.error(`${table}: HTTP ${response.status}. ${response.status === 404 ? 'Run supabase/schema.sql in the SQL editor first.' : 'Check the project URL, server secret key, and table permissions.'}`); }
  }
  if (failed) process.exitCode = 1;
  else console.log('Read-only table checks passed. Restart the bot to begin mirroring; then confirm records arrive in Supabase. This check does not verify the write function.');
}
main().catch(() => { console.error('Could not reach Supabase. Check connectivity and whether the project is paused.'); process.exitCode = 1; });
