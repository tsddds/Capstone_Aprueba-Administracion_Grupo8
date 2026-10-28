import { db, COL } from './repo.js';
import { enumeration } from '../lib/admin-validation.js';
import { QUESTION_FIELDS, QUESTION_STATUSES, validateQuestion } from '../lib/question-validation.js';

export async function updateQuestion(id, patch) {
  const ref = db.collection(COL.questions).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const current = snapshot.data();
    const merged = { ...current, ...patch };
    const status = enumeration(merged.status, 'status', QUESTION_STATUSES);
    const validated = validateQuestion(Object.fromEntries(QUESTION_FIELDS.map(key => [key, merged[key]])), {
      allowMissingClassification: status === 'draft',
    });
    validated.status = status;
    // La validación usa el resultado completo; solo se escriben los campos
    // solicitados. Una explanation omitida se conserva exactamente como estaba.
    const updates = Object.fromEntries(Object.keys(patch).map(key => [key, validated[key]]));
    transaction.update(ref, updates);
    return { ...current, ...updates, id: snapshot.id };
  });
}
