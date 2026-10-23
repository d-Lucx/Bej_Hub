import { spawn } from 'node:child_process';
import { authPolicy } from './auth-policy.js';
import { cloudEnabled, database } from './cloud-store.js';

async function main() {
  const missing = ['BEJ_OWNER_EMAIL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'].filter(name => !process.env[name]?.trim());
  if (!process.env.SUPABASE_SECRET_KEY?.trim() && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push('SUPABASE_SECRET_KEY');
  if (missing.length) { console.error(`Cloud startup blocked. Missing settings: ${missing.join(', ')}. Add them in Render Environment.`); process.exitCode = 1; return; }
  const policy = authPolicy();
  if (!policy.required || !cloudEnabled()) throw new Error('Cloud startup requires Google authentication and Supabase storage.');
  await database('studio_records?select=key&limit=0');
  const port = process.env.PORT || '10000';
  const children = [
    spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', port], { stdio: 'inherit', env: process.env }),
    spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/bot.ts'], { stdio: 'inherit', env: process.env }),
  ];
  let stopping = false;
  function stop(code: number) {
    if (stopping) return; stopping = true;
    for (const child of children) child.kill('SIGTERM');
    process.exitCode = code;
    setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 10000).unref();
  }
  for (const child of children) {
    child.on('error', () => { console.error('A cloud process could not start.'); stop(1); });
    child.on('exit', code => { if (!stopping) { console.error('A cloud process exited; restarting the service is required.'); stop(code || 1); } });
  }
  process.on('SIGTERM', () => stop(0)); process.on('SIGINT', () => stop(0));
}
main().catch(() => { console.error('Cloud startup blocked. Check Auth settings, Supabase server credentials, and supabase/cloud.sql.'); process.exitCode = 1; });
