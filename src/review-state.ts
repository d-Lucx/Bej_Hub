import { createHash } from 'node:crypto';
import type { Mission } from './contracts.ts';
export function reviewKey(mission: Mission) {
  return createHash('sha256').update(JSON.stringify([mission.status, mission.events?.length ?? 0, mission.clarifications ?? [], mission.draft ?? null])).digest('hex').slice(0, 12);
}
export function currentReview(mission: Mission, action: string, key?: string) {
  return (!key || key === reviewKey(mission)) && (action === 'approve' ? mission.status === 'WAITING_APPROVAL' : action === 'clarify' ? mission.status === 'WAITING_CLARIFICATION' : action === 'reject' && ['WAITING_APPROVAL', 'WAITING_CLARIFICATION'].includes(mission.status));
}
