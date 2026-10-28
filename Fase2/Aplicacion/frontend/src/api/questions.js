import { api } from './client.js';

// El catálogo auxiliar de recorrecciones necesita preguntas de todas las páginas.
export async function loadAllQuestions(get = api.get) {
  const rows = [];
  const visited = new Set();
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const result = await get(`/questions?${query}`);
    rows.push(...result.data);
    cursor = result.meta?.pagination?.nextCursor ?? null;
    if (cursor) {
      if (visited.has(cursor)) throw new Error('No se pudo completar el catálogo de preguntas.');
      visited.add(cursor);
    }
  } while (cursor);
  return rows;
}
