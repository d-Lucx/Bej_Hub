import { WebhookClient } from 'discord.js';
import type { Role } from './contracts.js';
import type { Messenger } from './studio.js';

const names: Record<Role, string> = { manager: 'Bej Manager', researcher: 'Research Bot', writer: 'Writer Bot' };
export function chunks(text: string, limit = 1900): string[] {
  const result: string[] = [];
  let current = '';
  for (const character of text) {
    if (current.length + character.length > limit) { result.push(current); current = ''; }
    current += character;
  }
  if (current) result.push(current);
  return result;
}
export function authorized(guild: string | null, channel: string | null, user: string, settings: { DISCORD_GUILD_ID: string; DISCORD_CHANNEL_ID: string; DISCORD_ALLOWED_USER_IDS: string[] }) {
  return guild === settings.DISCORD_GUILD_ID && channel === settings.DISCORD_CHANNEL_ID && settings.DISCORD_ALLOWED_USER_IDS.includes(user);
}
export class DiscordMessenger implements Messenger {
  private webhook: WebhookClient;
  constructor(url: string, private avatars: Partial<Record<Role, string>> = {}) { this.webhook = new WebhookClient({ url }); }
  async send(role: Role, text: string) {
    for (const content of chunks(text)) {
      try { await this.webhook.send({ content, username: names[role], avatarURL: this.avatars[role] || undefined, allowedMentions: { parse: [] } }); }
      catch { throw new Error('Discord delivery failed. Check webhook access and network connectivity.'); }
    }
  }
  destroy() { this.webhook.destroy(); }
}
