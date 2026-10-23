import { z } from 'zod';

export const Plan = z.object({ research_goal: z.string().min(1).max(3000), writing_goal: z.string().min(1).max(3000) }).strict();
export const Draft = z.object({ title: z.string().min(1).max(180), body: z.string().min(1).max(6000) }).strict();
export type Plan = z.infer<typeof Plan>;
export type Draft = z.infer<typeof Draft>;
export type Role = 'manager' | 'researcher' | 'writer';
export type State = 'IDLE' | 'THINKING' | 'WORKING' | 'HANDOFF' | 'BLOCKED' | 'WAITING_CLARIFICATION' | 'WAITING_APPROVAL';
export type Source = { title: string; url: string };
export type Brief = { text: string; sources: Source[]; grounding: unknown; mock: boolean; source_kind?: 'supplied'; supplied_text?: string; alignment?: 'supported' | 'conflict' | 'insufficient'; clarification_question?: string };
export type Result<T> = { value: T; tokens: number };
export interface Provider {
  mode: 'mock' | 'gemini';
  plan(prompt: string, sourceText?: string): Promise<Result<Plan>>;
  research(goal: string, sourceText?: string): Promise<Result<Brief>>;
  write(goal: string, brief: Brief): Promise<Result<Draft>>;
}
export type StudioEvent = {
  version: 1; mission_id: string; agent_id: Role; next_state: State;
  target_agent?: Role; speech_bubble: string; payload: unknown; timestamp: string;
};
export type Mission = {
  id: string; prompt: string; created_by: string; mode: Provider['mode'];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_CLARIFICATION' | 'WAITING_APPROVAL' | 'REJECTED' | 'DELIVERING'; tokens_used: number;
  created_at: string; events: StudioEvent[]; brief?: Brief; draft?: Draft; error?: string; source_text?: string;
  clarifications?: string[]; plan?: Plan; requires_human_approval?: boolean; reviewed_by?: string; reviewed_at?: string;
};
