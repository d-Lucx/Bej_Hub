import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { Mission } from './contracts.js';

export function reviewMessage(mission: Mission) {
  const clarification = mission.status === 'WAITING_CLARIFICATION';
  const embed = new EmbedBuilder().setColor(clarification ? 0xb78b4c : 0x66866b)
    .setTitle(clarification ? 'Your clarification is needed' : 'Review draft · awaiting approval')
    .setDescription(clarification ? (mission.brief?.clarification_question || 'Please clarify this mission.').slice(0, 3500) : `**${mission.draft?.title ?? 'Draft'}**\n${mission.draft?.body ?? ''}`.slice(0, 3500))
    .setFooter({ text: `Mission ${mission.id} · ${mission.mode}${mission.brief?.source_kind === 'supplied' ? ' · [S1] Supplied text; not independently verified' : ''}` });
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (clarification) row.addComponents(new ButtonBuilder().setCustomId(`bej:clarify:${mission.id}`).setLabel('Clarify').setStyle(ButtonStyle.Primary));
  else row.addComponents(new ButtonBuilder().setCustomId(`bej:approve:${mission.id}`).setLabel('Approve & deliver').setStyle(ButtonStyle.Success));
  row.addComponents(new ButtonBuilder().setCustomId(`bej:reject:${mission.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger));
  return { content: clarification ? 'Writer is paused until you clarify the request.' : 'Review preview only. Approval delivers the final draft to this private office. Full text is available in the web office.', embeds: [embed], components: [row], allowedMentions: { parse: [] as never[] } };
}
