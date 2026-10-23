import { z } from 'zod';
const id = z.string().regex(/^\d{17,20}$/);
const configSchema = z.object({
  AI_MODE: z.enum(['mock', 'gemini']).default('mock'),
  RESEARCH_MODE: z.enum(['supplied', 'google_search']).default('supplied'),
  GEMINI_API_KEY: z.string().optional(), GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  DISCORD_BOT_TOKEN: z.string().min(20), DISCORD_APPLICATION_ID: id,
  DISCORD_GUILD_ID: id, DISCORD_CHANNEL_ID: id,
  DISCORD_WEBHOOK_URL: z.string().regex(/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/),
  DISCORD_ALLOWED_USER_IDS: z.string().transform(value => value.split(',').map(v => v.trim())).pipe(z.array(id).min(1)),
});
export function config() {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Check these .env settings: ${[...new Set(parsed.error.issues.map(issue => issue.path.join('.')))].join(', ')}`);
  if (parsed.data.AI_MODE === 'gemini' && !parsed.data.GEMINI_API_KEY) throw new Error('Set GEMINI_API_KEY for live mode.');
  return parsed.data;
}
