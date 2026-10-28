import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '../api/client.js';
import { questionOptions, editableOptions } from '../api/question-options.js';
import QuestionExplanation from '../components/QuestionExplanation.jsx';
import { parseQuestionImport } from '../api/question-import.js';
import {
  Kpi, Card, Loading, ErrorBox, EmptyState, Modal, Field, FormGrid, Select,
  Toast, useToast, Pill, Pager,
} from '../components/ui.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const DIFFICULTIES = ['d1', 'd2', 'd3', 'd4'];
const STATUSES = ['draft', 'published', 'flagged', 'retired'];
const STATUS_TAG = { draft: ['w', 'qs_draft'], published: ['g', 'qs_published'], flagged: ['w', 'qs_flagged'], retired: ['', 'qs_retired'] };
const PAGE_SIZE = 20;

const emptyQuestion = () => ({
  testId: '', axis: '', difficulty: 'd1',
  statement: '', options: ['', '', '', '', ''],
  correctAnswer: 'A', explanation: '', requiredSkill: '', status: 'draft',
});

const formFrom = (q) => ({
  testId: q.testId || '', axis: q.axis || '', difficulty: q.difficulty || '',
  statement: q.statement || '',
  options: editableOptions(q.options),
  correctAnswer: q.correctAnswer || 'A',
  explanation: q.explanation || '', requiredSkill: q.requiredSkill || '',
  status: q.status || 'draft',
});

export default function Content({ ctx }) {
  const { L, fmt } = ctx;
  const t = useToast();

  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [filters, setFilters] = useState({ testId: '', axis: '', difficulty: '', status: '' });
  const [dialog, setDialog] = useState(null); // {kind:'form'|'import', question?}
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [summary, setSummary] = useState({ published: 0, draft: 0, tests: 0 });
  const requestVersion = useRef(0);
  const seen = useRef({ tests: new Set(), axes: new Set() });

  const load = useCallback(async (f, p = 0) => {
    const version = ++requestVersion.current;
    setErr(null);
    setRows(null);
    try {
      const r = await api.get(`/questions${qs({ ...f, limit: PAGE_SIZE, page: p + 1 })}`);
      if (version !== requestVersion.current) return;
      setRows(r.data);
      setTotal(r.meta.pagination.total);
      setHasNext(Boolean(r.meta.pagination.nextCursor));
      setSummary(r.meta.summary);
      seen.current = {
        tests: new Set(r.meta.filters.testIds), axes: new Set(r.meta.filters.axes),
      };
      r.data.forEach((q) => {
        if (q.testId) seen.current.tests.add(q.testId);
        if (q.axis) seen.current.axes.add(q.axis);
      });
    } catch (e) { if (version === requestVersion.current) setErr(e.message); }
  }, []);

  useEffect(() => {
    load(filters, page);
    return () => { requestVersion.current++; };
  }, [filters, page, load]);

  const setF = (k, v) => { setPage(0); setFilters((f) => ({ ...f, [k]: v })); };
  const opts = (set) => [...set].sort().map((v) => ({ value: v, label: v }));

  const kpis = { total, ...summary };

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const out = await fn();
      setDialog(null);
      if (okMsg) t.ok(okMsg);
      await load(filters, page);
      return out;
    } catch (e) {
      const fieldLabels = { testId: 'q_test', axis: 'q_axis', difficulty: 'q_difficulty', statement: 'q_statement', options: 'q_options', correctAnswer: 'q_correct', status: 'q_status' };
      const field = e.field?.split('.')[0];
      t.err(e.field ? e.message + ': ' + (fieldLabels[field] ? L(fieldLabels[field]) : e.field) : e.message);
      return null;
    } finally { setBusy(false); }
  };

  const save = (f, question) => {
    if (!f.statement.trim()) { t.err(L('q_err_statement')); return; }
    let options;
    try { options = questionOptions(f.options, f.correctAnswer); }
    catch (e) { t.err(L(e.message)); return; }
    const correctAnswer = f.correctAnswer;
    const base = {
      testId: f.testId.trim() || null, axis: f.axis.trim() || null, difficulty: f.difficulty || null,
      statement: f.statement.trim(), options, correctAnswer,
      explanation: f.explanation, requiredSkill: f.requiredSkill,
    };
    // POST fuerza status 'draft' en el backend; solo PUT puede publicar.
    if (question) run(() => api.put(`/questions/${question.id}`, { ...base, status: f.status }), L('q_updated'));
    else run(() => api.post('/questions', base), L('q_created'));
  };

  const runImport = async (testId, items) => {
    setBusy(true);
    try { return (await api.post('/questions/import', { testId, items })).data; }
    catch (error) { t.err(error.message); return null; }
    finally { setBusy(false); }
  };

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={() => load(filters, page)} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  return (
    <>
      <p className="sub" style={{ marginBottom: 14 }}>{L('q_intro')}</p>

      <div className="grid g4">
        <Kpi ic="📚" label={L('q_kpi_total')} value={fmt(kpis.total)} />
        <Kpi ic="✅" label={L('q_kpi_published')} value={fmt(kpis.published)} />
        <Kpi ic="✏️" label={L('q_kpi_draft')} value={fmt(kpis.draft)} />
        <Kpi ic="🧪" label={L('q_kpi_tests')} value={fmt(kpis.tests)} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="flex between wrap" style={{ gap: 10, marginBottom: 12 }}>
          <b>{L('q_table')}</b>
          <div className="flex" style={{ gap: 8 }}>
            <button className="btn sec sm" onClick={() => setDialog({ kind: 'import' })}>⬆️ {L('q_import')}</button>
            <button className="btn sm" onClick={() => setDialog({ kind: 'form' })}>+ {L('q_add')}</button>
          </div>
        </div>

        <div className="filters" style={{ marginBottom: 12 }}>
          <Select value={filters.testId} onChange={(v) => setF('testId', v)} options={opts(seen.current.tests)}
            placeholder={`${L('q_test')}: ${L('filter_all')}`} />
          <Select value={filters.axis} onChange={(v) => setF('axis', v)} options={opts(seen.current.axes)}
            placeholder={`${L('q_axis')}: ${L('filter_all')}`} />
          <Select value={filters.difficulty} onChange={(v) => setF('difficulty', v)} options={DIFFICULTIES.map((d) => ({ value: d, label: d.toUpperCase() }))}
            placeholder={`${L('q_difficulty')}: ${L('filter_all')}`} />
          <Select value={filters.status} onChange={(v) => setF('status', v)} options={STATUSES.map((s) => ({ value: s, label: L(STATUS_TAG[s][1]) }))}
            placeholder={`${L('q_status')}: ${L('filter_all')}`} />
          <button className="btn sec sm" onClick={() => { setPage(0); setFilters({ testId: '', axis: '', difficulty: '', status: '' }); }}>{L('clear_filters')}</button>
        </div>

        {rows.length === 0 ? <EmptyState msg={L('q_no_questions')} ic="📚" /> : (
          <div className="tbl-wrap"><table>
            <thead><tr>
              <th>{L('q_statement')}</th><th>{L('q_test')}</th><th>{L('q_axis')}</th>
              <th>{L('q_difficulty')}</th><th>{L('q_correct')}</th><th>{L('q_status')}</th><th />
            </tr></thead>
            <tbody>{rows.map((q) => (
              <tr key={q.id}>
                <td>
                  <b className="clamp" style={{ fontSize: 13 }}>{q.statement}</b>
                  <div className="note">{q.id}</div>
                </td>
                <td><span className="tag">{q.testId || L('none')}</span></td>
                <td><span className="note">{q.axis || L('none')}</span></td>
                <td><span className="tag">{String(q.difficulty || '').toUpperCase() || L('none')}</span></td>
                <td><b>{q.correctAnswer}</b></td>
                <td><Pill value={q.status || 'draft'} map={STATUS_TAG} L={L} /></td>
                <td><div className="row-acts">
                  <button className="btn sec sm" onClick={() => setDialog({ kind: 'form', question: q })}>{L('edit')}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager page={page} shown={Math.min(page * PAGE_SIZE + rows.length, total)} total={total} hasNext={hasNext}
          onNext={() => { if (hasNext) setPage(p => p + 1); }} onPrev={() => setPage(p => Math.max(0, p - 1))} L={L} />
        {err && <ErrorBox msg={err} onRetry={() => load(filters, page)} L={L} />}
      </Card>

      {dialog?.kind === 'form' && (
        <QuestionForm question={dialog.question} ctx={ctx} busy={busy}
          tests={[...seen.current.tests]} axes={[...seen.current.axes]}
          onClose={() => setDialog(null)} onSave={save} />
      )}

      {dialog?.kind === 'import' && (
        <ImportDialog ctx={ctx} busy={busy} tests={[...seen.current.tests]}
          onClose={() => { setDialog(null); load(filters, page); }} onRun={runImport} />
      )}

      <Toast toast={t.toast} onDone={t.clear} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function QuestionForm({ question, ctx, busy, tests, axes, onClose, onSave }) {
  const { L } = ctx;
  const [f, setF] = useState(() => (question ? formFrom(question) : emptyQuestion()));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const onText = (k) => (e) => set(k)(e.target.value);
  const setOption = (i, v) => setF((s) => ({ ...s, options: s.options.map((o, j) => (j === i ? v : o)) }));

  return (
    <Modal wide busy={busy} title={question ? L('q_edit') : L('q_new')} subtitle={question?.id}
      onClose={onClose}
      footer={<>
        {!question && <span className="note left">{L('q_draft_hint')}</span>}
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={() => onSave(f, question)} disabled={busy}>{busy ? '…' : (question ? L('save') : L('create'))}</button>
      </>}>
      <FormGrid>
        <Field label={`${L('q_test')} *`} hint={tests.length ? tests.join(' · ') : undefined}>
          <input value={f.testId} onChange={onText('testId')} list="q-tests" placeholder="m1" />
          <datalist id="q-tests">{tests.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label={`${L('q_axis')} *`}>
          <input maxLength={200} value={f.axis} onChange={onText('axis')} list="q-axes" placeholder="Álgebra" />
          <datalist id="q-axes">{axes.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label={L('q_difficulty')}>
          <Select value={f.difficulty} onChange={set('difficulty')} placeholder={L('none')} options={DIFFICULTIES.map((d) => ({ value: d, label: d.toUpperCase() }))} />
        </Field>
        <Field label={L('q_status')} hint={question ? undefined : L('q_draft_hint')}>
          <Select value={f.status} onChange={set('status')} disabled={!question}
            options={STATUSES.map((s) => ({ value: s, label: L(STATUS_TAG[s][1]) }))} />
        </Field>
        <Field wide label={`${L('q_statement')} *`}>
          <textarea maxLength={20000} value={f.statement} onChange={onText('statement')} />
        </Field>
      </FormGrid>

      <div className="section-label">{L('q_options')}</div>
      <p className="note" style={{ marginBottom: 4 }}>{L('q_options_hint')}</p>
      {f.options.map((o, i) => (
        <div key={i} className={`opt-row ${f.correctAnswer === LETTERS[i] ? 'correct' : ''}`}>
          <button type="button" className="k" title={L('q_correct')} onClick={() => set('correctAnswer')(LETTERS[i])}>{LETTERS[i]}</button>
          <input maxLength={5000} value={o} onChange={(e) => setOption(i, e.target.value)} />
        </div>
      ))}

      <FormGrid>
        <QuestionExplanation value={f.explanation} onChange={set('explanation')} L={L} busy={busy} />
        <Field wide label={`${L('q_skill')} *`}><input maxLength={2000} value={f.requiredSkill} onChange={onText('requiredSkill')} /></Field>
      </FormGrid>
    </Modal>
  );
}

function ImportDialog({ ctx, busy, tests, onClose, onRun }) {
  const { L } = ctx;
  const [testId, setTestId] = useState('');
  const [text, setText] = useState('');
  const [parseErr, setParseErr] = useState(null);
  const [result, setResult] = useState(null);

  const submit = async () => {
    setParseErr(null);
    setResult(null);
    let payload;
    try { payload = parseQuestionImport(text, testId); }
    catch (error) { setParseErr(L(error.message)); return; }
    const out = await onRun(payload.testId, payload.items);
    if (out) setResult(out);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setParseErr(null);
    setResult(null);
  };

  let count = null;
  try { const p = JSON.parse(text); if (Array.isArray(p)) count = p.length; else if (Array.isArray(p?.items)) count = p.items.length; } catch { /* borrador aún inválido */ }

  return (
    <Modal wide busy={busy} title={L('q_import_title')} onClose={onClose}
      footer={<>
        {count != null && <span className="note left">{count} ítems</span>}
        <button className="btn sec" onClick={onClose} disabled={busy}>{L(result ? 'close' : 'cancel')}</button>
        <button className="btn" onClick={submit} disabled={busy || !text.trim()}>{busy ? '…' : L('q_import_run')}</button>
      </>}>
      <FormGrid>
        <Field label={L('q_import_test')} hint={tests.length ? tests.join(' · ') : undefined}>
          <input value={testId} onChange={(e) => { setTestId(e.target.value); setResult(null); }} list="imp-tests" placeholder="m1" disabled={busy} />
          <datalist id="imp-tests">{tests.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label={L('q_import_file')}>
          <input type="file" accept=".json,application/json" onChange={onFile} disabled={busy} />
        </Field>
      </FormGrid>
      <Field wide label="JSON" hint={L('q_import_hint')}>
        <textarea className="mono" style={{ minHeight: 220 }} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} disabled={busy}
          placeholder='[{"pregunta":"¿Cuánto es 2 + 2?","alternativas":["3","4"],"respuesta_correcta":"B","explicacion_respuesta":"Dos más dos son cuatro.","habilidad_requerida":"Sumar","eje":"Números","dificultad":"d1"}]' />
      </Field>
      <p className="note">{L('q_import_policy')}</p>
      {parseErr && <div className="err">{parseErr}</div>}
      {result && (
        <div role="status" style={{ marginTop: 12 }}>
          <b>{L('q_import_result', { imported: result.imported, skipped: result.skipped, errors: result.errors.length })}</b>
          {result.errors.length > 0 && <ul>{result.errors.map(error => (
            <li key={error.index}>{L('q_import_row', { row: error.index + 1 })}: {error.message} {error.field ? `(${error.field})` : ''} — {error.code}</li>
          ))}</ul>}
          {result.duplicates.length > 0 && <p className="note">{L('q_import_duplicates')}: {result.duplicates.map(row => row.index + 1).join(', ')}</p>}
        </div>
      )}
    </Modal>
  );
}
