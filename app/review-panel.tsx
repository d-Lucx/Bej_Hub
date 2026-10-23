'use client';
import { useState } from 'react';
export default function ReviewPanel({ missions, queue, online, onNotice }: { missions: any[]; queue: any[]; online: boolean; onNotice: (value: string) => void }) {
  if (!missions.length) return null;
  return <section className="review-panel" aria-label="Needs your attention"><div className="eyebrow">A HUMAN TOUCH</div><h2>Your team needs a little guidance.</h2>{missions.map(mission => <ReviewCard key={mission.id} mission={mission} queued={queue.some(entry => entry.review_id === mission.id && ['QUEUED', 'RUNNING'].includes(entry.status))} online={online} onNotice={onNotice} />)}</section>;
}
function ReviewCard({ mission, queued, online, onNotice }: { mission: any; queued: boolean; online: boolean; onNotice: (value: string) => void }) {
  const [response, setResponse] = useState(''); const [busy, setBusy] = useState(false);
  const clarification = mission.status === 'WAITING_CLARIFICATION';
  async function respond(action: string) {
    setBusy(true);
    try {
      const result = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mission.id, action, key: mission.review_key, ...(action === 'clarify' ? { response } : {}) }) });
      const data = await result.json(); onNotice(result.ok ? data.message : data.error);
    } catch { onNotice('Could not send your review. Check the office connection.'); }
    finally { setBusy(false); }
  }
  return <article className="review-card"><div className="review-title"><b>{clarification ? 'Clarification needed' : 'Draft awaiting approval'}</b><span>{mission.mode}</span></div><p className="review-prompt">{mission.prompt}</p>{clarification ? <><p>{mission.clarification_question}</p><label htmlFor={`clarify-${mission.id}`}>Tell the team what you meant</label><textarea id={`clarify-${mission.id}`} maxLength={2000} value={response} onChange={event => setResponse(event.target.value)} placeholder="Focus on the reading app described in the source, rather than filmmaking…" /></> : <div className="review-draft"><h3>{mission.draft?.title}</h3><p>{mission.draft?.body}</p><small>{mission.source_kind === 'supplied' ? '[S1] Supplied reference text; not independently verified.' : 'Review the research and source references before approving.'}</small></div>}<div className="review-actions"><button className="primary" disabled={busy || queued || clarification && !response.trim()} onClick={() => respond(clarification ? 'clarify' : 'approve')}>{queued ? 'Response queued…' : clarification ? 'Send clarification & resume' : 'Approve & deliver to Discord'}</button><button className="secondary" disabled={busy || queued} onClick={() => respond('reject')}>Reject mission</button></div><small>{!online ? 'The bot must be running to apply your response. ' : ''}{clarification ? 'Resuming repeats planning and research and may use additional quota.' : 'Approval sends the saved draft to your private Discord office. No new AI generation.'}</small><details><summary>Mission details</summary><p>ID: {mission.id}</p>{mission.source_text && <p className="source-preview">Supplied reference:<br />{mission.source_text}</p>}</details></article>;
}
