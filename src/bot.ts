import { Client, Events, GatewayIntentBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { config } from './config.js';
import { authorized, DiscordMessenger } from './discord.js';
import { GeminiProvider, MockProvider } from './providers.js';
import { Studio } from './studio.js';
import { startWebQueue } from './web-queue.js';
import { startSupabaseSync } from './supabase-sync.js';
import { startBotStatus } from './bot-status.js';
import { reviewMessage } from './discord-review.js';
import { APP_VERSION } from './version.js';

async function main() {
  const settings = config();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const messenger = new DiscordMessenger(settings.DISCORD_WEBHOOK_URL, {
    manager: process.env.MANAGER_AVATAR_URL, researcher: process.env.RESEARCHER_AVATAR_URL, writer: process.env.WRITER_AVATAR_URL,
  }, async mission => {
    const channel = await client.channels.fetch(settings.DISCORD_CHANNEL_ID);
    if (!channel?.isSendable()) throw new Error('Office channel cannot receive review cards.');
    await channel.send(reviewMessage(mission));
  });
  const studio = new Studio(settings.AI_MODE === 'mock' ? new MockProvider() : new GeminiProvider(settings.GEMINI_API_KEY!, settings.GEMINI_MODEL), messenger, 'data/missions', settings.RESEARCH_MODE, true);
  // Validate the destination before allowing any mission to post through it.
  const webhookResponse = await fetch(settings.DISCORD_WEBHOOK_URL, { signal: AbortSignal.timeout(15000) });
  if (!webhookResponse.ok) throw new Error('Cannot validate the office webhook.');
  const webhook = await webhookResponse.json() as { channel_id?: string; guild_id?: string };
  if (webhook.channel_id !== settings.DISCORD_CHANNEL_ID || webhook.guild_id !== settings.DISCORD_GUILD_ID) throw new Error('Webhook must belong to the configured office channel and server.');
  client.once(Events.ClientReady, ready => {
    console.log(`Bej Hub v${APP_VERSION} connected as ${ready.user.tag} (${settings.AI_MODE}).`);
    startWebQueue(studio);
    startSupabaseSync();
    startBotStatus(() => ({ online: client.isReady(), version: APP_VERSION, mode: settings.AI_MODE, model: settings.GEMINI_MODEL, researchMode: settings.RESEARCH_MODE, activeMission: studio.active?.id }));
  });
  client.on(Events.Error, () => console.error('Discord connection error. Check connectivity.'));
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;
    try {
      if (!authorized(interaction.guildId, interaction.channelId, interaction.user.id, settings)) {
        await interaction.reply({ content: 'This command is restricted to the configured office and allowed users.', flags: MessageFlags.Ephemeral }); return;
      }
      if (interaction.isButton() || interaction.isModalSubmit()) {
        const parts = interaction.customId.split(':');
        if (parts[0] !== 'bej' || parts.length !== 3) return;
        const [, action, id] = parts;
        if (interaction.isButton() && action === 'clarify') {
          const input = new TextInputBuilder().setCustomId('response').setLabel('Clarify the intended task or subject').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000);
          await interaction.showModal(new ModalBuilder().setCustomId(`bej:clarify-form:${id}`).setTitle('Clarify this mission').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)));
          return;
        }
        const resolved = action === 'clarify-form' && interaction.isModalSubmit() ? 'clarify' : action;
        if (resolved !== 'approve' && resolved !== 'reject' && resolved !== 'clarify') return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await studio.respond(id, resolved, interaction.user.id, interaction.isModalSubmit() ? interaction.fields.getTextInputValue('response') : undefined);
        await interaction.editReply(`Mission ${result.id}: ${result.status.toLowerCase()}.`).catch(() => {});
        return;
      }
      if (interaction.commandName === 'status') {
        await interaction.reply({ content: studio.status(), flags: MessageFlags.Ephemeral }); return;
      }
      if (['approve', 'reject', 'clarify'].includes(interaction.commandName)) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await studio.respond(interaction.options.getString('mission_id', true), interaction.commandName as 'approve' | 'reject' | 'clarify', interaction.user.id, interaction.options.getString('response') ?? undefined);
        await interaction.editReply(`Mission ${result.id}: ${result.status.toLowerCase()}.`).catch(() => {});
        return;
      }
      if (interaction.commandName !== 'mission') return;
      if (studio.busy) { await interaction.reply({ content: 'The office is busy. Use /status to check progress.', flags: MessageFlags.Ephemeral }); return; }
      const prompt = interaction.options.getString('prompt', true);
      const sources = interaction.options.getString('sources') ?? undefined;
      if ((settings.RESEARCH_MODE === 'supplied' && sources === undefined) || (sources !== undefined && (!sources.trim() || sources.length > 6000))) {
        await interaction.reply({ content: 'Add 1–6000 characters of reference text in the sources option. Paste the content, not just a link; links are not fetched.', flags: MessageFlags.Ephemeral }); return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      // run() reserves the single mission slot synchronously, even for concurrent interactions.
      const result = await studio.run(prompt, interaction.user.id, sources);
      await interaction.editReply(`Mission ${result.id.slice(0, 8)}: ${result.status.toLowerCase()}. See the agent messages in this channel.`).catch(() => {});
    } catch {
      console.error('Command failed. Check local configuration and mission records.');
      const content = 'The command could not finish. Check /status and the local mission log.';
      if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => {});
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
  await client.login(settings.DISCORD_BOT_TOKEN);
}
main().catch(error => { console.error(error instanceof Error && !/token/i.test(error.message) ? error.message : 'Startup failed. Check Discord credentials locally.'); process.exitCode = 1; });
