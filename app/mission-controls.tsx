'use client';
import { useState } from 'react';
import { APP_VERSION } from '../src/version';

export function BotBanner({ office, connected }: { office: any; connected: boolean }) {
  if (!office || !connected) return null;
  const outdated = office.bot?.online && office.bot.version !== APP_VERSION;
  return <div className={`bot-banner ${office.bot?.online && !outdated ? 'ready' : ''}`} role="status"><span><b>{outdated ? `Restart the bot to load v${APP_VERSION}` : office.bot?.online ? 'Bot is ready' : 'Bot is offline or needs a restart'}</b><small>{outdated ? 'Stop the bot terminal with Ctrl+C, then run bej.cmd start to load the release and pixel avatars.' : office.bot?.online ? `v${office.bot.version} · ${office.bot.mode === 'mock' ? 'Mock mode · no AI calls' : `${office.bot.model} · live AI`} · ${office.bot.activeMission ? 'A mission is running' : 'Ready for your next mission'}` : 'Run bej.cmd start in a separate terminal. Queued work waits until the bot connects.'}</small></span><span className="bot-pill">{office.bot?.online ? '● Online' : '○ Offline'}</span></div>;
}
export function QueuePanel({ items, onNotice }: { items: any[]; onNotice: (value: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function cancel(id: string) {
    setBusy(id);
    try {
      const response = await fetch('/api/missions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel' }) });
      const data = await response.json();
      onNotice(response.ok ? data.message : data.error);
    } catch { onNotice('Could not cancel this request. Check the office connection.'); }
    finally { setBusy(null); }
  }
  if (!items.length) return null;
  return <section className="queue-panel" aria-label="Mission queue"><h2>Mission queue</h2><p>Cancel work before it starts. Running missions finish normally.</p>{items.slice(0, 8).map(item => <div className="queue-row" key={item.id}><div><b>{item.prompt}</b><small>{item.status.toLowerCase()}{item.error ? ` · ${item.error}` : ''}</small></div>{item.status === 'QUEUED' && <button disabled={busy !== null} onClick={() => cancel(item.id)}>{busy === item.id ? 'Cancelling…' : 'Cancel'}</button>}</div>)}</section>;
}
export function RetryMission({ mission, onReview }: { mission: any; onReview: (mission: any) => void }) {
  if (mission.status !== 'FAILED') return null;
  return <div className="retry-row"><p>Review the prompt and sources before retrying. Earlier Discord messages may already have been sent.</p><button className="secondary" onClick={() => onReview(mission)}>Review & retry ↗</button></div>;
}
