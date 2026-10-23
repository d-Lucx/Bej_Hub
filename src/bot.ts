import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { authorized, DiscordMessenger } from './discord.js';
import { GeminiProvider, MockProvider } from './providers.js';
import { Studio } from './studio.js';
import { startWebQueue } from './web-queue.js';
import { startSupabaseSync } from './supabase-sync.js';
import { startBotStatus } from './bot-status.js';

async function main() {
  const settings = config();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const messenger = new DiscordMessenger(settings.DISCORD_WEBHOOK_URL, {
    manager: process.env.MANAGER_AVATAR_URL, researcher: process.env.RESEARCHER_AVATAR_URL, writer: process.env.WRITER_AVATAR_URL,
  });
  const studio = new Studio(settings.AI_MODE === 'mock' ? new MockProvider() : new GeminiProvider(settings.GEMINI_API_KEY!, settings.GEMINI_MODEL), messenger, 'data/missions', settings.RESEARCH_MODE);
  // Validate the destination before allowing any mission to post through it.
  const webhookResponse = await fetch(settings.DISCORD_WEBHOOK_URL, { signal: AbortSignal.timeout(15000) });
  if (!webhookResponse.ok) throw new Error('Cannot validate the office webhook.');
  const webhook = await webhookResponse.json() as { channel_id?: string; guild_id?: string };
  if (webhook.channel_id !== settings.DISCORD_CHANNEL_ID || webhook.guild_id !== settings.DISCORD_GUILD_ID) throw new Error('Webhook must belong to the configured office channel and server.');
  client.once(Events.ClientReady, ready => {
    console.log(`Bej Hub connected as ${ready.user.tag} (${settings.AI_MODE}).`);
    startWebQueue(studio);
    startSupabaseSync();
    startBotStatus(() => ({ online: client.isReady(), mode: settings.AI_MODE, model: settings.GEMINI_MODEL, researchMode: settings.RESEARCH_MODE, activeMission: studio.active?.id }));
  });
  client.on(Events.Error, () => console.error('Discord connection error. Check connectivity.'));
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    try {
      if (!authorized(interaction.guildId, interaction.channelId, interaction.user.id, settings)) {
        await interaction.reply({ content: 'This command is restricted to the configured office and allowed users.', flags: MessageFlags.Ephemeral }); return;
      }
      if (interaction.commandName === 'status') {
        await interaction.reply({ content: studio.status(), flags: MessageFlags.Ephemeral }); return;
      }
      if (interaction.commandName !== 'mission') return;
      if (studio.active) { await interaction.reply({ content: 'The office is busy. Use /status to check progress.', flags: MessageFlags.Ephemeral }); return; }
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
