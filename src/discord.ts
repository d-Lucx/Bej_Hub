import { WebhookClient } from 'discord.js';
import type { Role, Mission } from './contracts.js';
import type { Messenger } from './studio.js';
// Keep artwork pinned to its published tag when application versions change.
const AVATAR_VERSION = '1.0.0';

const names: Record<Role, string> = { manager: 'Bej Manager', researcher: 'Research Bot', writer: 'Writer Bot' };
export const PIXEL_AVATARS: Record<Role, string> = {
  manager: `https://raw.githubusercontent.com/d-Lucx/Bej_Hub/v${AVATAR_VERSION}/public/avatars/manager.png`,
  researcher: `https://raw.githubusercontent.com/d-Lucx/Bej_Hub/v${AVATAR_VERSION}/public/avatars/researcher.png`,
  writer: `https://raw.githubusercontent.com/d-Lucx/Bej_Hub/v${AVATAR_VERSION}/public/avatars/writer.png`,
};
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
  constructor(url: string, private avatars: Partial<Record<Role, string>> = {}, private review?: (mission: Mission) => Promise<void>) { this.webhook = new WebhookClient({ url }); }
  async requestReview(mission: Mission) { await this.review?.(mission); }
  async send(role: Role, text: string) {
    for (const content of chunks(text)) {
      try { await this.webhook.send({ content, username: names[role], avatarURL: this.avatars[role]?.trim() || PIXEL_AVATARS[role], allowedMentions: { parse: [] } }); }
      catch { throw new Error('Discord delivery failed. Check webhook access and network connectivity.'); }
    }
  }
  destroy() { this.webhook.destroy(); }
}
