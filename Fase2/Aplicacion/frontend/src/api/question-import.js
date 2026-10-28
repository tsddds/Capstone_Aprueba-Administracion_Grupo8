export function parseQuestionImport(text, selectedTest = '') {
  let source;
  try { source = JSON.parse(text); } catch { throw new Error('q_import_invalid'); }
  let testId = selectedTest.trim();
  let items;
  if (Array.isArray(source)) items = source;
  else if (source && typeof source === 'object' && Array.isArray(source.items)
    && Object.keys(source).every(key => ['testId', 'items'].includes(key))) {
    if (testId && source.testId !== undefined && testId !== source.testId) throw new Error('q_import_test_conflict');
    testId = testId || source.testId;
    items = source.items;
  } else throw new Error('q_import_invalid');
  if (typeof testId !== 'string' || !['lectora', 'm1', 'm2', 'cien', 'hist', 'b1'].includes(testId)) throw new Error('q_import_test_required');
  if (!items.length || items.length > 100) throw new Error('q_import_limit');
  return { testId, items };
}
