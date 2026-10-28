import { createHash } from 'node:crypto';
import { invalid } from './admin-validation.js';
export function paginate(rows, query, { fields, defaultSort = 'id', filterKeys = [] }) {
  const { limit = '20', page, cursor, sort = defaultSort } = query;
  const integer = (x, key, max) => {
    if (typeof x !== 'string' || !/^[1-9]\d*$/.test(x) || !Number.isSafeInteger(Number(x)) || Number(x) > max) invalid(key);
    return Number(x);
  };
  const size = integer(limit, 'limit', 100);
  if (typeof sort !== 'string' || !fields.includes(sort.replace(/^-/, ''))) invalid('sort');
  if (page !== undefined && cursor !== undefined) invalid('cursor', 'No combinar page y cursor');
  const field = sort.replace(/^-/, ''), direction = sort.startsWith('-') ? -1 : 1;
  const compare = (a, b) => {
    const av = a[field] ?? '', bv = b[field] ?? '';
    return (av < bv ? -1 : av > bv ? 1 : 0) * direction || String(a.id).localeCompare(String(b.id), 'en');
  };
  rows.sort(compare);
  const signature = createHash('sha256').update(JSON.stringify([sort, ...filterKeys.map(k => query[k] ?? '')])).digest('hex').slice(0, 24);
  let start = page === undefined ? 0 : (integer(page, 'page', 1000000) - 1) * size;
  if (cursor !== undefined) {
    if (typeof cursor !== 'string' || cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) invalid('cursor');
    let data;
    try { data = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch { invalid('cursor'); }
    if (data?.v !== 1 || data.signature !== signature || typeof data.id !== 'string') invalid('cursor', 'Cursor incompatible con los filtros');
    const index = rows.findIndex(r => r.id === data.id);
    if (index < 0) invalid('cursor', 'El cursor ya no existe; reinicie la consulta');
    start = index + 1;
  }
  const items = rows.slice(start, start + size);
  const nextCursor = start + size < rows.length && items.length
    ? Buffer.from(JSON.stringify({ v: 1, id: items.at(-1).id, signature })).toString('base64url') : null;
  return { items, pagination: { total: rows.length, limit: size, nextCursor } };
}
