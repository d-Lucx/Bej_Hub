import { GeminiProvider } from './providers.js';
import { Studio } from './studio.js';

async function main() {
  if (!process.env.GEMINI_API_KEY?.trim()) throw new Error('Set GEMINI_API_KEY in .env first.');
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const supplied = (process.env.RESEARCH_MODE || 'supplied') === 'supplied';
  console.log(`Testing Gemini model ${model}. Output stays local; no Discord messages are sent.`);
  const studio = new Studio(new GeminiProvider(process.env.GEMINI_API_KEY, model), {
    async send(role, text) { console.log(`\n[${role}] ${text}`); },
  });
  const mission = await studio.run(
    supplied ? 'Analyze the supplied project notes and draft a short welcome message for Bej Hub. Identify any missing details.' : 'Using official Discord documentation, research what a Discord webhook is and how its username can be overridden. Produce a brief with sources and a 100-word introductory Discord draft for Bej Hub. Do not discuss pricing.',
    'local-live-test',
    supplied ? 'Bej Hub project notes (test fixture): Bej Hub is a virtual studio with a Manager, Researcher, and Writer. Users submit missions in a private Discord office. The Manager plans the task, the Researcher analyzes supplied material, and the Writer produces a draft. The 2D office is planned for a later phase. No launch date has been set.' : undefined,
  );
  console.log(`\nResult: ${mission.status}. Reported tokens: ${mission.tokens_used}. Sources: ${mission.brief?.sources.length ?? 0}.`);
  console.log(`Saved data/missions/${mission.id}.json`);
  if (mission.error) { console.error(mission.error); process.exitCode = 1; }
}
main().catch(() => { console.error('Live test could not complete. Check local configuration and network connectivity.'); process.exitCode = 1; });
