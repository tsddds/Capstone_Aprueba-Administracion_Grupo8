import { useRef } from 'react';
import { Field, FormGrid, Select } from './ui.jsx';

const emptyExplanation = () => ({
  title: '', subject: '', steps: [{ label: '', body: '' }], verification: '', keyConcept: '',
});

export default function QuestionExplanation({ value, onChange, L, busy }) {
  const structured = value !== null && typeof value === 'object';
  // Mantiene ambos borradores al cambiar de formato, sin conversiones implícitas.
  const drafts = useRef({ text: structured ? '' : value, structured: structured ? value : emptyExplanation() });
  const set = (key, content) => onChange({ ...value, [key]: content });
  const setStep = (index, key, content) => set('steps', value.steps.map((step, i) => i === index ? { ...step, [key]: content } : step));
  const switchMode = mode => {
    drafts.current[structured ? 'structured' : 'text'] = value;
    onChange(drafts.current[mode]);
  };
  return (
    <>
      <Field wide label={L('q_explanation_format')}>
        <Select value={structured ? 'structured' : 'text'} onChange={switchMode} disabled={busy}
          options={[{ value: 'text', label: L('q_explanation_text') }, { value: 'structured', label: L('q_explanation_structured') }]} />
      </Field>
      {!structured ? (
        <Field wide label={`${L('q_explanation')} *`}>
          <textarea maxLength={20000} value={value} onChange={e => onChange(e.target.value)} />
        </Field>
      ) : (
        <Field wide label={L('q_explanation')}>
          <FormGrid>
            <Field label={`${L('q_explanation_title')} *`}><input maxLength={200} value={value.title || ''} onChange={e => set('title', e.target.value)} /></Field>
            <Field label={`${L('q_explanation_subject')} *`}><input maxLength={200} value={value.subject || ''} onChange={e => set('subject', e.target.value)} /></Field>
          </FormGrid>
          {(value.steps || []).map((step, index) => (
            <fieldset key={index} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, margin: '12px 0', minWidth: 0 }}>
              <legend>{L('q_explanation_step')} {index + 1}</legend>
              <Field label={`${L('q_explanation_label')} *`}><input maxLength={200} value={step.label || ''} onChange={e => setStep(index, 'label', e.target.value)} /></Field>
              <Field label={`${L('q_explanation_body')} *`}><textarea maxLength={20000} value={step.body || ''} onChange={e => setStep(index, 'body', e.target.value)} /></Field>
              <button type="button" className="btn dgr sm" disabled={busy || value.steps.length === 1}
                onClick={() => set('steps', value.steps.filter((_, i) => i !== index))}>{L('q_explanation_remove_step')}</button>
            </fieldset>
          ))}
          <button type="button" className="btn sec sm" disabled={busy || value.steps.length >= 100}
            onClick={() => set('steps', [...value.steps, { label: '', body: '' }])}>+ {L('q_explanation_add_step')}</button>
          <Field label={`${L('q_explanation_verification')} *`}><textarea maxLength={20000} value={value.verification || ''} onChange={e => set('verification', e.target.value)} /></Field>
          <Field label={`${L('q_explanation_key_concept')} *`}><textarea maxLength={2000} value={value.keyConcept || ''} onChange={e => set('keyConcept', e.target.value)} /></Field>
        </Field>
      )}
    </>
  );
}
