export const DEV_PROJECT = 'demo-aprueba-equipo';
export const TEST_PROJECT = 'demo-aprueba-tests';
export const DEMO_PASSWORD = 'SoloEmulador_2026_Prueba!';
export const DEMO_JWT = 'SOLO_EMULADOR_APRUEBA_NO_USAR_EN_INTERNET_2026';

// Ejecutar ANTES de importar firebase-admin o dotenv. No hay fallback a la nube.
export function assertEmulatorOnly(env = process.env, { testOnly = false } = {}) {
  const project = env.GCLOUD_PROJECT;
  if (!(testOnly ? [TEST_PROJECT] : [DEV_PROJECT, TEST_PROJECT]).includes(project)) {
    throw new Error('Se requiere GCLOUD_PROJECT demo-aprueba-equipo o demo-aprueba-tests.');
  }
  if (!/^(127\.0\.0\.1|localhost|firestore|firestore-test):[0-9]{2,5}$/.test(env.FIRESTORE_EMULATOR_HOST || '')) {
    throw new Error('Se requiere emulador local explícito; no se permite Firestore remoto.');
  }
  const port = Number(env.FIRESTORE_EMULATOR_HOST.split(':').at(-1));
  if (port < 1 || port > 65535) throw new Error('Puerto inválido.');
  for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'STRIPE_SECRET_KEY', 'FIREBASE_TOKEN']) {
    if (env[key]) throw new Error(`Retira ${key} del entorno de pruebas; no se utilizan credenciales reales.`);
  }
  if (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== project) throw new Error('Proyecto Google incompatible.');
  return { project, host: env.FIRESTORE_EMULATOR_HOST };
}
