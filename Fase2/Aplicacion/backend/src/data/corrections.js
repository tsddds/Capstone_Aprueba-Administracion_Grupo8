import { db, COL } from './repo.js';
import { AdminError, enumeration, identifier, invalid, idValid, pick } from '../lib/admin-validation.js';
import { QUESTION_FIELDS, QUESTION_STATUSES, validateQuestion } from '../lib/question-validation.js';

// Solo se leen referencias de la página actual. No se entrega el perfil completo
// del alumno ni se concede a soporte acceso al resto del banco de preguntas.
export async function correctionReferences(rows) {
  const userIds = [...new Set(rows.map(row => row.userId).filter(idValid))];
  const questionIds = [...new Set(rows.map(row => row.questionId).filter(idValid))];
  const [users, questions] = await Promise.all([
    userIds.length ? db.getAll(...userIds.map(id => db.collection(COL.users).doc(id))) : [],
    questionIds.length ? db.getAll(...questionIds.map(id => db.collection(COL.questions).doc(id))) : [],
  ]);
  const userMap = new Map(users.filter(doc => doc.exists).map(doc => [doc.id, { id: doc.id, ...pick(doc.data(), ['name']) }]));
  const questionMap = new Map(questions.filter(doc => doc.exists).map(doc => [doc.id, { id: doc.id, ...pick(doc.data(), [...QUESTION_FIELDS, 'status']) }]));
  return rows.map(row => ({ ...row, user: userMap.get(row.userId) ?? null, question: questionMap.get(row.questionId) ?? null }));
}

const REWARD = { tier: 'bronze', amount: 250 };

export async function resolveCorrection(id, actorId, { resolution, questionPatch, note }) {
  const ref = db.collection(COL.corrections).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AdminError(404, 'NOT_FOUND', 'Solicitud no encontrada');
    const correction = snapshot.data();
    if (correction.state !== 'pending') {
      throw new AdminError(409, 'CORRECTION_ALREADY_RESOLVED', 'La solicitud ya no está pendiente');
    }
    const userRef = db.collection(COL.users).doc(identifier(correction.userId, 'userId'));
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new AdminError(404, 'NOT_FOUND', 'Alumno no encontrado');
    let questionRef;
    let updates;
    let bronze;
    if (resolution === 'confirmed') {
      const user = userSnapshot.data();
      if (user.medals !== undefined && (!user.medals || typeof user.medals !== 'object' || Array.isArray(user.medals))) invalid('medals');
      bronze = user.medals?.bronze === undefined ? 0 : user.medals.bronze;
      if (!Number.isSafeInteger(bronze) || bronze < 0 || !Number.isSafeInteger(bronze + REWARD.amount)) invalid('medals.bronze');
      questionRef = db.collection(COL.questions).doc(identifier(correction.questionId, 'questionId'));
      const questionSnapshot = await transaction.get(questionRef);
      if (!questionSnapshot.exists) throw new AdminError(404, 'NOT_FOUND', 'Pregunta no encontrada');
      if (questionPatch) {
        const merged = { ...questionSnapshot.data(), ...questionPatch };
        const validated = validateQuestion(pick(merged, QUESTION_FIELDS));
        validated.status = enumeration(merged.status, 'status', QUESTION_STATUSES);
        // Validar el resultado completo sin reescribir explanation ni campos omitidos.
        updates = pick(validated, Object.keys(questionPatch));
      }
    }
    const resolvedAt = new Date().toISOString();
    const rewardGranted = resolution === 'confirmed' ? { userId: userRef.id, ...REWARD } : null;
    transaction.update(ref, { state: resolution, resolvedBy: actorId, resolvedAt, rewardGranted,
      ...(note === undefined ? {} : { note }),
    });
    if (rewardGranted) {
      // badges es un contador genérico independiente: no es saldo de bronce.
      transaction.update(userRef, { 'medals.bronze': bronze + REWARD.amount });
      transaction.create(userRef.collection('medalMovements').doc(id), {
        correctionId: id, ...REWARD, createdAt: resolvedAt, actorId,
      });
    }
    if (updates) transaction.update(questionRef, updates);
    transaction.create(userRef.collection('notifications').doc(id), {
      type: 'correction_resolved', correctionId: id, state: resolution,
      message: rewardGranted ? 'Tu recorrección fue confirmada. Recibiste 250 medallas de bronce.' : 'Tu recorrección fue rechazada.',
      createdAt: resolvedAt, read: false,
    });
    return { id, state: resolution, rewardGranted };
  });
}
