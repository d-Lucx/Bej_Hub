import { REST, Routes } from 'discord.js';
import { z } from 'zod';
import { config } from './config.js';
import { readMission } from './mission-store.js';
import { closedReviewMessage, currentReview } from './discord-review.js';
async function main() {
  const settings = config();
  const rest = new REST({ version: '10' }).setToken(settings.DISCORD_BOT_TOKEN);
  const user = await rest.get(Routes.user('@me')) as { id: string };
  if (user.id !== settings.DISCORD_APPLICATION_ID) throw new Error();
  const channel = await rest.get(Routes.channel(settings.DISCORD_CHANNEL_ID)) as { guild_id: string };
  if (channel.guild_id !== settings.DISCORD_GUILD_ID) throw new Error();
  let before: string | undefined; let closed = 0;
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ limit: '100', ...(before ? { before } : {}) });
    const messages = await rest.get(Routes.channelMessages(settings.DISCORD_CHANNEL_ID), { query }) as any[];
    for (const message of messages) {
      if (message.author?.id !== user.id) continue;
      const custom = message.components?.flatMap((row: any) => row.components ?? []).map((button: any) => button.custom_id).find((id: unknown) => typeof id === 'string' && /^bej:(approve|clarify):/.test(id));
      if (!custom) continue;
      const [, action, id, key] = custom.split(':');
      if (!z.uuid().safeParse(id).success) continue;
      let mission;
      try { mission = await readMission(id); } catch { continue; }
      if (currentReview(mission, action, key)) continue;
      await rest.patch(Routes.channelMessage(settings.DISCORD_CHANNEL_ID, message.id), { body: { ...closedReviewMessage(mission), embeds: message.embeds?.map((embed: any) => ({ ...embed, title: 'Review closed', color: 0x85857c })) } });
      closed++;
    }
    if (messages.length < 100) break;
    before = messages.at(-1).id;
  }
  console.log(`Closed ${closed} resolved Discord review cards. Pending reviews were preserved; no new messages were sent.`);
}
main().catch(() => { console.error('Review cleanup stopped. Check Discord permissions, local mission records, and connectivity.'); process.exitCode = 1; });
