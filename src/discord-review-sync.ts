import { mkdir, readFile, readdir, unlink, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { ChannelType, EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { z } from 'zod';
import type { Mission } from './contracts.js';
import { closedReviewMessage, currentReview, reviewKey, reviewMessage } from './discord-review.js';
import { cloudEnabled, cloudList, cloudWrite, cloudDelete } from './cloud-store.js';
import { readMission } from './mission-store.js';
import { randomUUID } from 'node:crypto';

type Card = { message: string; mission: string; action: string; key?: string };
export class DiscordReviews {
  private busy = false;
  constructor(private client: Client, private channelId: string, private directory = 'data/review-cards', private missions = 'data/missions') {}
  private async channel(): Promise<TextChannel> {
    const channel = await this.client.channels.fetch(this.channelId);
    if (channel?.type !== ChannelType.GuildText) throw new Error('Office must be a server text channel.');
    return channel;
  }
  private async remember(card: Card) {
    if (cloudEnabled()) { await cloudWrite('reviews', card.message, card); return; }
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, `${card.message}.json`); const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(card)); await rename(temp, path);
  }
  private async forget(message: string) {
    if (cloudEnabled()) await cloudDelete('reviews', message);
    else await unlink(join(this.directory, `${message}.json`));
  }
  private async cards(): Promise<Card[]> {
    if (cloudEnabled()) return cloudList<Card>('reviews');
    await mkdir(this.directory, { recursive: true });
    const files = (await readdir(this.directory)).filter(name => /^\d+\.json$/.test(name));
    return Promise.all(files.map(async file => JSON.parse(await readFile(join(this.directory, file), 'utf8')) as Card));
  }
  async send(mission: Mission) {
    const message = await (await this.channel()).send(reviewMessage(mission));
    await this.remember({ message: message.id, mission: mission.id, action: mission.status === 'WAITING_CLARIFICATION' ? 'clarify' : 'approve', key: reviewKey(mission) });
  }
  // Recover recent v1.0 cards too. Registered cards remain trackable beyond 100 messages.
  async recover() {
    const messages = await (await this.channel()).messages.fetch({ limit: 100 });
    for (const message of messages.values()) {
      if (message.author.id !== this.client.user?.id) continue;
      for (const row of message.components) {
        if (!('components' in row)) continue;
        for (const component of row.components) {
          if (!('customId' in component) || !component.customId) continue;
          const [prefix, action, mission, key] = component.customId.split(':');
          if (prefix !== 'bej' || !['approve', 'clarify'].includes(action) || !z.uuid().safeParse(mission).success) continue;
          await this.remember({ message: message.id, mission, action, key });
        }
      }
    }
    await this.sync();
  }
  async sync() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const card of await this.cards()) {
        try {
          if (!z.uuid().safeParse(card.mission).success) continue;
          const mission = await readMission(card.mission, this.missions);
          if (currentReview(mission, card.action, card.key)) continue;
          const channel = await this.channel();
          const message = await channel.messages.fetch(card.message);
          const embed = message.embeds[0] ? EmbedBuilder.from(message.embeds[0]).setTitle('Review closed').setColor(0x85857c) : undefined;
          await message.edit({ ...closedReviewMessage(mission), ...(embed ? { embeds: [embed] } : {}) });
          await this.forget(card.message);
        } catch (error: any) {
          // Deleted cards need no further work; other failures retry next tick.
          if (error?.code === 10008) await this.forget(card.message).catch(() => {});
        }
      }
    } finally { this.busy = false; }
  }
  start() {
    void this.recover().catch(() => console.error('Could not recover old review cards. Check Read Message History and View Channel permissions.'));
    const timer = setInterval(() => { void this.sync().catch(() => console.error('Review card sync will retry.')); }, 5000);
    return () => clearInterval(timer);
  }
}
