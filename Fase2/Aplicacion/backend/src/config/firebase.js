// Inicialización del Firebase Admin SDK.
// Soporta tres modos, en este orden de prioridad:
//   1. Credenciales de cuenta de servicio (GOOGLE_APPLICATION_CREDENTIALS) -> Firestore real
//   2. Emulador de Firestore (FIRESTORE_EMULATOR_HOST)                    -> Firestore local
//   3. Credenciales por defecto del entorno (GCP / `gcloud auth`)
import admin from 'firebase-admin';

const projectId = process.env.GCLOUD_PROJECT || 'aprueba-dev';

if (!admin.apps.length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Modo emulador: no se necesitan credenciales reales.
    admin.initializeApp({ projectId });
    console.log(`[firebase] Conectado al emulador de Firestore en ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    admin.initializeApp({
      credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? admin.credential.cert(
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    )
        : admin.credential.applicationDefault(),
      projectId,
    });
    console.log('[firebase] Conectado a Firestore (credenciales del entorno)');
  }
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export default admin;
