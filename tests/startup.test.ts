import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startup } from '../src/start.js';

test('Render default start launches both cloud processes without requiring a local env file', () => {
  const selected = startup({ RENDER: 'true', NODE_ENV: 'development' });
  assert.equal(selected.mode, 'cloud');
  assert.equal(selected.args.at(-1), 'src/cloud.ts');
  assert(!selected.args.some(arg => arg.includes('--env-file')));
  assert.equal(startup({ NODE_ENV: 'production' }).mode, 'cloud');
});
test('local default start preserves bot-only startup with the local env file', () => {
  const selected = startup({ NODE_ENV: 'development' });
  assert.equal(selected.mode, 'local bot');
  assert.deepEqual(selected.args, ['node_modules/tsx/dist/cli.mjs', '--env-file=.env', 'src/bot.ts']);
});
