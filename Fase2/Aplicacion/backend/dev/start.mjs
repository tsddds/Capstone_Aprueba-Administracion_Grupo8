import { existsSync } from 'node:fs';
import { assertEmulatorOnly, DEMO_JWT } from './safety.mjs';
assertEmulatorOnly();
if (existsSync('.env')) throw new Error('El arranque aislado no admite backend/.env. Use las variables de Compose.');
process.env.JWT_SECRET = DEMO_JWT;
await import('../src/index.js');
