import { randomUUID } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Mission, Provider, Role, State, StudioEvent } from './contracts.js';
import { readMission, saveMission } from './mission-store.js';
import { cloudEnabled, rpc } from './cloud-store.js';
import { currentReview } from './review-state.js';

export interface Messenger { send(role: Role, text: string): Promise<void>; requestReview?(mission: Mission): Promise<void> }
export class Studio {
  active?: Mission;
  last?: Mission;
  sessionTokens = 0;
  private reserved = false;
  get busy() { return this.reserved || !!this.active; }
  // Local CLI demos can opt out; the bot always enables human approval.
  constructor(private provider: Provider, private messenger: Messenger, private directory = 'data/missions', private researchMode: 'google_search' | 'supplied' = 'google_search', private approvalRequired = false) {}
  private async save(mission: Mission) {
    await saveMission(mission, this.directory);
  }
  private async event(mission: Mission, role: Role, state: State, speech: string, payload: unknown = {}, target?: Role) {
    const entry: StudioEvent = { version: 1, mission_id: mission.id, agent_id: role, next_state: state, target_agent: target, speech_bubble: speech, payload, timestamp: new Date().toISOString() };
    mission.events.push(entry);
    await this.save(mission);
    await this.messenger.send(role, `[${state}] ${speech}`);
  }
  private count(mission: Mission, tokens: number) { mission.tokens_used += tokens; this.sessionTokens += tokens; }
  private sourceFooter(mission: Mission) {
    const brief = mission.brief!;
    return brief.source_kind === 'supplied' ? '[S1] User-supplied reference text. Not independently verified; no web search performed.' : brief.sources.map((source, i) => `[${i + 1}] ${source.title}: ${source.url}`).join('\n') || 'None — simulated research.';
  }
  private async notifyReview(mission: Mission) {
    try { await this.messenger.requestReview?.(mission); }
    catch { console.error(`Review notification unavailable for mission ${mission.id}. Respond in the local office or with a slash command.`); }
  }
  private async deliver(mission: Mission) {
    // Persist the side-effect boundary so a crash cannot silently replay delivery.
    mission.status = 'DELIVERING'; await this.save(mission);
    await this.messenger.send('writer', `DRAFT${mission.mode === 'mock' ? ' · MOCK' : ''}${mission.brief?.source_kind === 'supplied' ? ' · SUPPLIED SOURCES' : ''}${mission.reviewed_by ? ' · APPROVED' : ''}\n**${mission.draft!.title}**\n${mission.draft!.body}\n\n${this.sourceFooter(mission)}`);
    await this.event(mission, 'writer', 'IDLE', 'Draft delivered to the private office.');
    await this.event(mission, 'researcher', 'IDLE', 'Research complete.');
    await this.event(mission, 'manager', 'IDLE', `Mission complete. ${mission.tokens_used} reported tokens used.`);
    mission.status = 'COMPLETED';
  }
  private async execute(mission: Mission) {
    await this.event(mission, 'manager', 'THINKING', 'Planning the research → writing workflow.');
    const goal = `${mission.prompt}${mission.clarifications?.length ? `\nHuman clarification (supersedes conflicting assumptions): ${mission.clarifications.join('\n')}` : ''}`;
    const plan = await this.provider.plan(goal, mission.source_text); this.count(mission, plan.tokens); mission.plan = plan.value;
    await this.event(mission, 'manager', 'HANDOFF', 'Researcher, gather evidence for this mission.', plan.value, 'researcher');
    await this.event(mission, 'researcher', 'WORKING', mission.mode === 'mock' ? 'Simulating research; no web requests or token charges.' : mission.source_text !== undefined ? 'Analyzing supplied text; Google Search is disabled.' : 'Searching for sources and preparing the brief.');
    // Research receives the manager's current task only. Reattaching the original
    // premise here caused already-resolved conflicts to trigger another question.
    const research = await this.provider.research(plan.value.research_goal, mission.source_text); this.count(mission, research.tokens); mission.brief = research.value;
    await this.messenger.send('researcher', research.value.text + '\n\nSources:\n' + this.sourceFooter(mission));
    if (research.value.alignment && research.value.alignment !== 'supported') {
      mission.status = 'WAITING_CLARIFICATION';
      await this.event(mission, 'researcher', 'WAITING_CLARIFICATION', research.value.clarification_question || 'Please clarify the request: it does not match the supplied reference.');
      await this.notifyReview(mission); return;
    }
    await this.event(mission, 'researcher', 'HANDOFF', 'Research brief ready. Passing evidence to Writer.', research.value, 'writer');
    await this.event(mission, 'writer', 'WORKING', 'Drafting a post from the research brief.');
    const draft = await this.provider.write(plan.value.writing_goal, research.value); this.count(mission, draft.tokens); mission.draft = draft.value;
    if (mission.requires_human_approval) {
      mission.status = 'WAITING_APPROVAL';
      await this.event(mission, 'writer', 'WAITING_APPROVAL', 'Draft ready for your review. Approve to deliver it, or reject it.');
      await this.notifyReview(mission); return;
    }
    await this.deliver(mission);
  }
  private async process(mission: Mission, operation: () => Promise<void>) {
    this.active = mission;
    try { await operation(); }
    catch (error) {
      mission.status = 'FAILED'; mission.error = error instanceof Error ? error.message : 'Mission failed.';
      mission.events.push({ version: 1, mission_id: mission.id, agent_id: 'manager', next_state: 'BLOCKED', speech_bubble: 'Mission failed; review local logs and configuration.', payload: { error: mission.error }, timestamp: new Date().toISOString() });
      await this.messenger.send('manager', `Mission ${mission.id} failed. Review the local mission log; no automatic rerun was scheduled.`).catch(() => {});
    } finally {
      try { await this.save(mission); } finally { this.last = mission; this.active = undefined; }
    }
    return mission;
  }
  async run(prompt: string, user: string, sourceText?: string): Promise<Mission> {
    if (this.busy) throw new Error('The office is busy. Wait for the current mission to finish.');
    if (!prompt.trim() || prompt.length > 2000) throw new Error('Mission must contain 1–2000 characters.');
    if (this.researchMode === 'supplied' && sourceText === undefined) throw new Error('Provide reference text in the sources option.');
    if (sourceText !== undefined && (!sourceText.trim() || sourceText.length > 6000)) throw new Error('Source text must contain 1–6000 characters.');
    const mission: Mission = { id: randomUUID(), prompt, created_by: user, mode: this.provider.mode, status: 'RUNNING', tokens_used: 0, created_at: new Date().toISOString(), events: [], source_text: sourceText, requires_human_approval: this.approvalRequired };
    return this.process(mission, () => this.execute(mission));
  }
  async respond(id: string, action: 'approve' | 'reject' | 'clarify', user: string, response?: string, expectedKey?: string): Promise<Mission> {
    if (!z.uuid().safeParse(id).success) throw new Error('Use the full mission ID shown in the review card.');
    if (this.busy) throw new Error('The office is busy. Try the review action again when it is free.');
    if (action === 'clarify' && (!response?.trim() || response.length > 2000)) throw new Error('Clarification must contain 1–2000 characters.');
    this.reserved = true;
    let lock;
    const lockPath = join(this.directory, `${id}.review.lock`);
    try {
      const cloud = cloudEnabled() && this.directory === 'data/missions';
      if (!cloud) { try { lock = await open(lockPath, 'wx'); } catch { throw new Error('This mission is already being reviewed.'); } }
      const mission = await readMission(id, this.directory);
      if (!currentReview(mission, action, expectedKey)) throw new Error('This action no longer matches the mission state. Refresh the office or use /status.');
      const waiting = mission.status === 'WAITING_APPROVAL' || mission.status === 'WAITING_CLARIFICATION';
      if (!waiting || action === 'approve' && mission.status !== 'WAITING_APPROVAL' || action === 'clarify' && mission.status !== 'WAITING_CLARIFICATION') throw new Error('This action no longer matches the mission state. Refresh the office or use /status.');
      if (action === 'clarify' && mission.mode !== this.provider.mode) throw new Error('Use the original AI mode to resume this mission.');
      if (cloud && !await rpc<boolean>('claim_studio_review', { p_id: id, p_expected: mission, p_next: action === 'approve' ? 'DELIVERING' : 'RUNNING' })) throw new Error('This review was already claimed or changed. Refresh the office.');
      return await this.process(mission, async () => {
        if (action === 'reject') {
          mission.status = 'REJECTED'; mission.reviewed_by = user; mission.reviewed_at = new Date().toISOString();
          await this.event(mission, 'manager', 'IDLE', 'Mission rejected by a human. No final draft will be delivered.'); return;
        }
        if (action === 'clarify') {
          mission.clarifications = [...(mission.clarifications ?? []), response!.trim()].slice(-3);
          mission.status = 'RUNNING'; mission.draft = undefined; mission.error = undefined;
          await this.execute(mission); return;
        }
        if (!mission.draft || !mission.brief) throw new Error('This mission has no draft to approve.');
        mission.reviewed_by = user; mission.reviewed_at = new Date().toISOString();
        await this.deliver(mission);
      });
    } finally { this.reserved = false; if (lock) { await lock.close(); await unlink(lockPath); } }
  }
  status() {
    return `${this.active ? `Working: ${this.active.id}` : 'Office is quiet—assign a mission with /mission.'}\nMode: ${this.provider.mode}\nResearch mode: ${this.researchMode}\nDraft approval: ${this.approvalRequired ? 'required' : 'disabled for this local run'}\nSession tokens: ${this.sessionTokens}\nLast mission: ${this.last?.status ?? 'none'}. Pending reviews are saved in the office.`;
  }
}
