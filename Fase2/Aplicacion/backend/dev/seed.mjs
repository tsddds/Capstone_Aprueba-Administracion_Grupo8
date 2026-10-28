import { pathToFileURL } from 'node:url';
import { assertEmulatorOnly, DEMO_PASSWORD } from './safety.mjs';
import { buildFixtures } from './fixtures.mjs';

export async function seed({ project, host, now = new Date() }) {
  const actual = assertEmulatorOnly();
  if (actual.project !== project || actual.host !== host) throw new Error('El destino del seed no coincide con el entorno validado.');
  const { default: admin } = await import('firebase-admin');
  const { default: bcrypt } = await import('bcryptjs');
  const app = admin.initializeApp({ projectId: project }, `seed-${Date.now()}-${Math.random()}`);
  const db = app.firestore();
  const fixtures = buildFixtures(now);
  fixtures.adminUsers = ['admin', 'support', 'finance', 'ops'].map(role => ({
    id: `adm_demo_${role}`, email: `${role}@example.test`, name: `${role} SOLO EMULADOR`, role,
    mfaEnabled: false, passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
  }));
  let inserted = 0, existing = 0;
  try {
    // create() nunca pisa los cambios manuales del equipo. No borra colecciones.
    for (const [collection, docs] of Object.entries(fixtures)) {
      for (const { id, ...data } of docs) {
        try { await db.collection(collection).doc(id).create(data); inserted++; }
        catch (error) { if (error.code === 6 || error.code === 'already-exists') existing++; else throw error; }
      }
    }
    return { inserted, existing };
  } finally { await app.delete(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = assertEmulatorOnly();
  const result = await seed(target);
  console.log(`Seed seguro: ${result.inserted} creados, ${result.existing} ya existían. Proyecto ${target.project}.`);
}
