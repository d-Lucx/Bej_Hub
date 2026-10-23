import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { Mission, Provider, Role, State, StudioEvent } from './contracts.js';

export interface Messenger { send(role: Role, text: string): Promise<void> }
export class Studio {
  active?: Mission;
  last?: Mission;
  sessionTokens = 0;
  constructor(private provider: Provider, private messenger: Messenger, private directory = 'data/missions', private researchMode: 'google_search' | 'supplied' = 'google_search') {}
  private async save(mission: Mission) {
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, `${mission.id}.json`);
    await writeFile(`${path}.tmp`, JSON.stringify(mission, null, 2), 'utf8');
    await rename(`${path}.tmp`, path);
  }
  async run(prompt: string, user: string, sourceText?: string): Promise<Mission> {
    if (this.active) throw new Error('The office is busy. Wait for the current mission to finish.');
    if (!prompt.trim() || prompt.length > 2000) throw new Error('Mission must contain 1–2000 characters.');
    if (this.researchMode === 'supplied' && sourceText === undefined) throw new Error('Provide reference text in the sources option.');
    if (sourceText !== undefined && (!sourceText.trim() || sourceText.length > 6000)) throw new Error('Source text must contain 1–6000 characters.');
    const mission: Mission = { id: randomUUID(), prompt, created_by: user, mode: this.provider.mode, status: 'RUNNING', tokens_used: 0, created_at: new Date().toISOString(), events: [] };
    mission.source_text = sourceText;
    this.active = mission;
    const event = async (role: Role, state: State, speech: string, payload: unknown = {}, target?: Role) => {
      const entry: StudioEvent = { version: 1, mission_id: mission.id, agent_id: role, next_state: state, target_agent: target, speech_bubble: speech, payload, timestamp: new Date().toISOString() };
      mission.events.push(entry);
      await this.save(mission);
      await this.messenger.send(role, `[${mission.mode.toUpperCase()} · ${mission.id.slice(0, 8)} · ${state}] ${speech}`);
    };
    const count = (tokens: number) => { mission.tokens_used += tokens; this.sessionTokens += tokens; };
    try {
      await event('manager', 'THINKING', 'Planning the research → writing workflow.');
      const plan = await this.provider.plan(prompt); count(plan.tokens);
      await event('manager', 'HANDOFF', 'Researcher, gather evidence for this mission.', plan.value, 'researcher');
      await event('researcher', 'WORKING', this.provider.mode === 'mock' ? 'Simulating research; no web requests or token charges.' : sourceText !== undefined ? 'Analyzing supplied text; Google Search is disabled.' : 'Searching for sources and preparing the brief.');
      const research = await this.provider.research(plan.value.research_goal, sourceText); count(research.tokens);
      mission.brief = research.value;
      await event('researcher', 'HANDOFF', 'Research brief ready. Passing evidence to Writer.', research.value, 'writer');
      const sourceFooter = research.value.source_kind === 'supplied' ? '[S1] User-supplied reference text. Not independently verified; no web search performed.' : research.value.sources.map((source, i) => `[${i + 1}] ${source.title}: ${source.url}`).join('\n') || 'None — simulated research.';
      await this.messenger.send('researcher', research.value.text + '\n\nSources:\n' + sourceFooter);
      await event('writer', 'WORKING', 'Drafting a post from the research brief.');
      const draft = await this.provider.write(plan.value.writing_goal, research.value); count(draft.tokens);
      mission.draft = draft.value;
      await this.save(mission);
      await this.messenger.send('writer', `DRAFT${this.provider.mode === 'mock' ? ' · MOCK' : ''}${research.value.source_kind === 'supplied' ? ' · SUPPLIED SOURCES' : ''}\n**${draft.value.title}**\n${draft.value.body}\n\n` + sourceFooter);
      await event('writer', 'IDLE', 'Draft delivered to the private office.');
      await event('researcher', 'IDLE', 'Research complete.');
      await event('manager', 'IDLE', `Mission complete. ${mission.tokens_used} reported tokens used.`);
      mission.status = 'COMPLETED';
    } catch (error) {
      mission.status = 'FAILED';
      mission.error = error instanceof Error ? error.message : 'Mission failed.';
      mission.events.push({ version: 1, mission_id: mission.id, agent_id: 'manager', next_state: 'BLOCKED', speech_bubble: 'Mission failed; review local logs and configuration.', payload: { error: mission.error }, timestamp: new Date().toISOString() });
      // Avoid leaking arbitrary provider/transport errors or credentials to Discord.
      await this.messenger.send('manager', `Mission ${mission.id.slice(0, 8)} failed. Review the local mission log; no automatic rerun was scheduled.`).catch(() => {});
    } finally {
      try { await this.save(mission); } finally { this.last = mission; this.active = undefined; }
    }
    return mission;
  }
  status() {
    return `${this.active ? `Working: ${this.active.id}` : 'Office is quiet—assign a mission with /mission.'}\nMode: ${this.provider.mode}\nResearch mode: ${this.researchMode}\nSession tokens: ${this.sessionTokens}\nLast mission: ${this.last?.status ?? 'none'}`;
  }
}
