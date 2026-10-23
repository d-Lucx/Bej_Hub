import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';
async function main() {
  const settings = config();
  const rest = new REST({ version: '10' }).setToken(settings.DISCORD_BOT_TOKEN);
  const commands = [
    new SlashCommandBuilder().setName('mission').setDescription('Ask Bej Hub to research a topic and draft a post.').addStringOption(option => option.setName('prompt').setDescription('What should the team research and write?').setRequired(true).setMaxLength(2000)).addStringOption(option => option.setName('sources').setDescription('Paste reference text (not just a URL). Analyzed without Google Search.').setMaxLength(6000)),
    new SlashCommandBuilder().setName('status').setDescription('See the office activity and session token usage.'),
  ];
  // Individual upserts preserve unrelated commands on an existing bot application.
  for (const command of commands) await rest.post(Routes.applicationGuildCommands(settings.DISCORD_APPLICATION_ID, settings.DISCORD_GUILD_ID), { body: command.toJSON() });
  console.log('Registered /mission and /status in your server.');
}
main().catch(() => { console.error('Registration failed. Check application, server, bot token, and installation scopes.'); process.exitCode = 1; });
