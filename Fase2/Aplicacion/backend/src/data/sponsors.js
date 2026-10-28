import { db, COL, FieldValue } from './repo.js';

// Actualiza solo si el documento sigue existiendo; una baja concurrente no lo recrea.
export async function updateSponsor(id, patch) {
  const ref = db.collection(COL.sponsors).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data().deletedAt) return null;
    transaction.update(ref, patch);
    return { ...snapshot.data(), ...patch, id: snapshot.id };
  });
}

// Baja lógica: conserva el sponsor y sus referencias históricas. Sus beneficios
// embebidos quedan inactivos en la misma transacción; no se borran canjes.
export async function deactivateSponsor(id) {
  const ref = db.collection(COL.sponsors).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data().deletedAt) return false;
    const data = snapshot.data();
    const patch = { deletedAt: FieldValue.serverTimestamp(), status: 'down', benefitsOffered: 0 };
    if (Array.isArray(data.benefits)) {
      patch.benefits = data.benefits.map(benefit => (
        typeof benefit === 'string' ? { name: benefit, active: false }
          : { ...benefit, active: false }
      ));
    }
    transaction.update(ref, patch);
    return true;
  });
}
