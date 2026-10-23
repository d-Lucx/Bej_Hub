import { readFile } from 'node:fs/promises';
import { REST, Routes } from 'discord.js';
import { config } from './config.js';

// One-time identity setup; no bot login, channel posts, or AI calls.
async function main() {
  const settings = config();
  const rest = new REST({ version: '10' }).setToken(settings.DISCORD_BOT_TOKEN);
  const user = await rest.get(Routes.user('@me')) as { id: string };
  if (user.id !== settings.DISCORD_APPLICATION_ID) throw new Error('The bot token does not match the configured application.');
  const webhookResponse = await fetch(settings.DISCORD_WEBHOOK_URL, { signal: AbortSignal.timeout(15000) });
  if (!webhookResponse.ok) throw new Error('Could not validate the office webhook.');
  const webhook = await webhookResponse.json() as { channel_id: string; guild_id: string };
  if (webhook.channel_id !== settings.DISCORD_CHANNEL_ID || webhook.guild_id !== settings.DISCORD_GUILD_ID) throw new Error('The webhook does not match the configured office.');
  const image = await readFile('public/brand/bej-hub.png');
  const body = { avatar: `data:image/png;base64,${image.toString('base64')}` };
  await rest.patch(Routes.user('@me'), { body });
  console.log('Updated Bej Hub bot avatar.');
  const updated = await fetch(settings.DISCORD_WEBHOOK_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!updated.ok) throw new Error('Bot avatar updated, but the office webhook avatar could not be updated.');
  console.log('Updated office webhook default avatar. Agent messages use their individual pixel avatars after bot restart.');
}
main().catch(error => { console.error(error instanceof Error && /^(The bot token|Could not validate|The webhook|Bot avatar updated)/.test(error.message) ? error.message : 'Discord avatar setup failed. Check local credentials and connectivity.'); process.exitCode = 1; });
