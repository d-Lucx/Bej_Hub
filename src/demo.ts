import { MockProvider } from './providers.js';
import { Studio } from './studio.js';
const studio = new Studio(new MockProvider(), { async send(role, text) { console.log(`\n[${role}] ${text}`); } });
const mission = await studio.run(process.argv.slice(2).join(' ') || 'Research how a virtual AI studio can help a solo creator, then draft a short welcome post.', 'local-demo');
console.log(`\nSaved data/missions/${mission.id}.json`);
if (mission.status !== 'COMPLETED') process.exitCode = 1;
