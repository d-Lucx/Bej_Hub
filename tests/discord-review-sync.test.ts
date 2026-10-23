import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ChannelType, type Client } from 'discord.js';
import { DiscordReviews } from '../src/discord-review-sync.js';
import { saveMission } from '../src/mission-store.js';
import type { Mission } from '../src/contracts.js';

test('Discord cards close after external approval and recent legacy cards are repaired on restart', async () => {
  const root = resolve('data/test-workspaces'); await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, 'cards-'));
  const missionDirectory = join(directory, 'missions'); const cardsDirectory = join(directory, 'cards');
  const edits: any[] = []; let counter = 1000;
  const messages = new Map<string, any>();
  const channel = {
    type: ChannelType.GuildText,
    async send(body: any) {
      const id = String(++counter);
      const message = { id, author: { id: 'bot' }, components: body.components.map((row: any) => ({ components: row.components.map((button: any) => ({ customId: button.data.custom_id })) })), embeds: body.embeds.map((embed: any) => embed.toJSON()), async edit(update: any) { edits.push(update); message.components = []; } };
      messages.set(id, message); return message;
    },
    messages: { async fetch(input: any) { return typeof input === 'string' ? messages.get(input) : messages; } },
  };
  const client = { user: { id: 'bot' }, channels: { async fetch() { return channel; } } } as unknown as Client;
  const mission = { id: 'c4ae0e1a-e180-4f68-b3ae-2c3dba75a649', prompt: 'Welcome', created_by: 'owner', created_at: new Date().toISOString(), mode: 'mock', status: 'WAITING_APPROVAL', tokens_used: 0, events: [], draft: { title: 'Welcome', body: 'Hello' } } as Mission;
  try {
    const reviews = new DiscordReviews(client, 'office', cardsDirectory, missionDirectory);
    await saveMission(mission, missionDirectory); await reviews.send(mission);
    await reviews.sync(); assert.equal(edits.length, 0);
    mission.status = 'COMPLETED'; await saveMission(mission, missionDirectory);
    await reviews.sync(); assert.equal(edits.length, 1); assert.deepEqual(edits[0].components, []);
    assert.match(edits[0].content, /completed/); assert.deepEqual(await readdir(cardsDirectory), []);
    await channel.send({ components: [{ components: [{ data: { custom_id: `bej:clarify:${mission.id}` } }] }], embeds: [] });
    await reviews.recover(); assert.equal(edits.length, 2); assert.deepEqual(edits[1].components, []);
  } finally { assert(directory.startsWith(root)); await rm(directory, { recursive: true, force: true }); }
});
