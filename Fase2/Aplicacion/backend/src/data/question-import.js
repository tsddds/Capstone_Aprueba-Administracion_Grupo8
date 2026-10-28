import { db, COL, listAll } from './repo.js';
import { importQuestionBatch, questionImportKey } from '../lib/question-import.js';

// Índice interno para serializar filas iguales entre importaciones simultáneas.
// Si la pregunta vinculada cambió su enunciado/prueba, la clave puede reutilizarse.
async function writeImportedQuestion(question, existingId) {
  const key = questionImportKey(question);
  const indexRef = db.collection('questionImportKeys').doc(key);
  return db.runTransaction(async transaction => {
    const index = await transaction.get(indexRef);
    const candidates = new Set([existingId, index.data()?.questionId].filter(id => typeof id === 'string' && id.length));
    for (const id of candidates) {
      const stored = await transaction.get(db.collection(COL.questions).doc(id));
      if (stored.exists && typeof stored.data().statement === 'string' && questionImportKey(stored.data()) === key) {
        transaction.set(indexRef, { questionId: stored.id });
        return { id: stored.id, imported: false };
      }
    }
    const ref = db.collection(COL.questions).doc();
    transaction.create(ref, { ...question, status: 'draft' });
    transaction.set(indexRef, { questionId: ref.id });
    return { id: ref.id, imported: true };
  });
}

export function importQuestions(body) {
  return importQuestionBatch(body, {
    readExisting: () => listAll(COL.questions), write: writeImportedQuestion,
  });
}
