import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function startup(env: NodeJS.ProcessEnv = process.env) {
  const cloud = env.RENDER === 'true' || env.NODE_ENV === 'production';
  return {
    mode: cloud ? 'cloud' : 'local bot',
    args: ['node_modules/tsx/dist/cli.mjs', ...(cloud ? [] : ['--env-file=.env']), cloud ? 'src/cloud.ts' : 'src/bot.ts'],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const selected = startup();
  console.log(`Starting Bej Hub ${selected.mode}.`);
  const child = spawn(process.execPath, selected.args, { stdio: 'inherit', env: process.env });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { stopping = true; child.kill(signal); });
  child.on('error', () => { console.error('Bej Hub could not start. Verify installed dependencies.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? (stopping ? 0 : 1); });
}
