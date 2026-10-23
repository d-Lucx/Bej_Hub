import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Report file names only, never matching credentials or file contents.
const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let env = '';
try { env = readFileSync('.env', 'utf8'); } catch { /* Signature checks still work on a fresh clone. */ }
const configuredSecrets = env.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([A-Z_]*(?:KEY|TOKEN|WEBHOOK_URL)|BEJ_OWNER_EMAIL)\s*=\s*(.*)$/);
  if (!match) return [];
  const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  return value.length >= 12 ? [value] : [];
});
const signatures = [/AIza[\w-]{30,}/, /sb_secret_[\w-]{20,}/, /https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]{30,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const problems: string[] = [];
for (const file of files) {
  if (/^(?:data|node_modules|\.next)\//.test(file) || /(^|\/)\.env(?:\..*)?$/.test(file) && !file.endsWith('.env.example')) { problems.push(`${file}: private/generated file`); continue; }
  const content = execFileSync('git', ['show', `:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (configuredSecrets.some(secret => content.includes(secret)) || signatures.some(pattern => pattern.test(content))) problems.push(`${file}: possible credential`);
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`Staged-file audit passed: ${files.length} files; no configured secrets or private/generated paths found.`);
