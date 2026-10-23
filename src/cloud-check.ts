import { database, rpc } from './cloud-store.js';
async function main() {
  await database('studio_records?select=key&limit=0');
  console.log('OK: private cloud storage table is accessible.');
  const absent = '00000000-0000-4000-8000-000000000000';
  const claimed = await rpc('claim_studio_review', { p_id: absent, p_expected: {}, p_next: 'RUNNING' });
  const queue = await rpc('transition_studio_queue', { p_id: absent, p_from: '__check__', p_to: 'QUEUED', p_patch: {} });
  if (claimed !== false || queue !== null) throw new Error('Unexpected verification result.');
  console.log('OK: atomic queue/review functions are callable; no mission or queue item was created or changed.');
  console.log(process.env.SUPABASE_PUBLISHABLE_KEY ? 'Auth key is present. Verify Google provider configuration and owner sign-in in the browser after deployment.' : 'Next: add SUPABASE_PUBLISHABLE_KEY for Google sign-in. Keep the server secret separate.');
}
main().catch(() => { console.error('Cloud storage check failed. Run supabase/schema.sql and supabase/cloud.sql, then verify the server credentials.'); process.exitCode = 1; });
