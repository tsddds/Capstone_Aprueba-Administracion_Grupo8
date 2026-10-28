import { api } from './client.js';

// La pantalla calcula sus indicadores sobre el listado completo.
export async function loadAllSponsors(get = api.get) {
  const rows = [];
  const visited = new Set();
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const result = await get(`/sponsors?${query}`);
    rows.push(...result.data);
    cursor = result.meta?.pagination?.nextCursor ?? null;
    if (cursor) {
      if (visited.has(cursor)) throw new Error('No se pudo completar el listado de sponsors.');
      visited.add(cursor);
    }
  } while (cursor);
  return rows;
}
