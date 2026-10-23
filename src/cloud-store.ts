import { supabaseSettings } from './supabase-config.ts';

export function cloudEnabled() {
  if (process.env.BEJ_STORAGE && !['local', 'supabase'].includes(process.env.BEJ_STORAGE)) throw new Error('BEJ_STORAGE must be local or supabase.');
  return process.env.BEJ_STORAGE === 'supabase';
}
export async function database<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const settings = supabaseSettings();
  const response = await fetch(`${settings.url}/rest/v1/${path}`, { ...options, headers: { ...settings.headers, ...options.headers }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Private database operation failed (HTTP ${response.status}). Check the cloud migration and service key.`);
  return response.status === 204 || response.headers.get('content-length') === '0' ? undefined as T : await response.json();
}
export function rpc<T = any>(name: string, body: unknown) { return database<T>(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) }); }
export async function allRows<T>(query: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await database<T[]>(`${query}&limit=500&offset=${offset}`);
    rows.push(...page); if (page.length < 500) return rows;
  }
}
export async function cloudRead<T>(bucket: string, key: string): Promise<T | undefined> {
  const rows = await database<{ document: T }[]>(`studio_records?bucket=eq.${encodeURIComponent(bucket)}&key=eq.${encodeURIComponent(key)}&select=document`);
  return rows[0]?.document;
}
export async function cloudList<T>(bucket: string): Promise<T[]> {
  return (await allRows<{ document: T }>(`studio_records?bucket=eq.${encodeURIComponent(bucket)}&select=document&order=key.asc`)).map(row => row.document);
}
export async function cloudWrite(bucket: string, key: string, document: unknown) {
  await database('studio_records?on_conflict=bucket,key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ bucket, key, document, updated_at: new Date().toISOString() }) });
}
export async function cloudDelete(bucket: string, key: string) {
  await database(`studio_records?bucket=eq.${encodeURIComponent(bucket)}&key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}
