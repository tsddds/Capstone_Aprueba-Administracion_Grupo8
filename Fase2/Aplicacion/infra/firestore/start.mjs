import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const project = process.env.EMULATOR_PROJECT || 'demo-aprueba-equipo';
if (!['demo-aprueba-equipo', 'demo-aprueba-tests'].includes(project)) {
  throw new Error('Solo proyectos demo autorizados para este emulador.');
}
const ephemeral = process.env.EMULATOR_EPHEMERAL === '1';
const args = ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start',
  '--only', 'firestore', '--project', project, '--config', ephemeral ? 'firebase.test.json' : 'firebase.json'];
if (process.env.EMULATOR_EPHEMERAL !== '1') {
  if (existsSync('/data/export/firebase-export-metadata.json')) args.push('--import=/data/export');
  args.push('--export-on-exit=/data/export');
}
const child = spawn(process.execPath, args, { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill('SIGINT'));
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error(error.message); process.exit(1); });
