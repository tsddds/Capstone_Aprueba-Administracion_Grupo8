import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { loadAllSponsors } from '../api/sponsors.js';
import {
  Kpi, Card, StatusPill, Loading, HBars, ErrorBox, EmptyState, Modal, Confirm,
  Field, FormGrid, Select, Toast, useToast,
} from '../components/ui.jsx';

// Catálogos del backend (routes/sponsors.js).
const TIERS = ['Bronze', 'Silver', 'Gold'];
const STATUSES = ['ok', 'deg', 'down'];

export default function Sponsors({ ctx }) {
  const { L, fmt } = ctx;
  const t = useToast();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr(null);
    try { setRows(await loadAllSponsors()); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      setDialog(null);
      if (okMsg) t.ok(okMsg);
      await load();
    } catch (e) { t.err(e.message); } finally { setBusy(false); }
  };

  const save = (form, sponsor) => {
    if (!form.name.trim()) { t.err(L('required_field')); return; }
    const fee = Number(form.monthlyFee);
    if (form.monthlyFee === '' || !Number.isFinite(fee) || fee < 0) {
      t.err(L('s_invalid_fee')); return;
    }
    if (!sponsor && form.benefits.some(b => !b.name.trim() ||
      b.costPlatinum === '' || b.stock === '' ||
      !Number.isSafeInteger(Number(b.costPlatinum)) || Number(b.costPlatinum) < 0 ||
      !Number.isSafeInteger(Number(b.stock)) || Number(b.stock) < 0)) {
      t.err(L('s_invalid_benefit')); return;
    }
    if (sponsor) {
      const offered = Number(form.benefitsOffered);
      if (form.benefitsOffered === '' || !Number.isSafeInteger(offered) || offered < 0) {
        t.err(L('s_invalid_offered')); return;
      }
      // PATCH acepta el total de beneficios, no el listado.
      run(() => api.patch(`/sponsors/${sponsor.id}`, {
        name: form.name.trim(),
        tier: form.tier,
        monthlyFee: fee,
        status: form.status,
        benefitsOffered: offered,
      }), L('saved_ok'));
    } else {
      // POST deriva benefitsOffered de la longitud del array `benefits`.
      run(() => api.post('/sponsors', {
        name: form.name.trim(),
        tier: form.tier,
        monthlyFee: fee,
        benefits: form.benefits.map(b => ({
          name: b.name.trim(), description: b.description.trim(),
          costPlatinum: Number(b.costPlatinum), stock: Number(b.stock),
        })),
      }), L('created_ok'));
    }
  };

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={load} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  const totRev = rows.reduce((a, s) => a + (s.monthlyFee || 0), 0);
  const totRed = rows.reduce((a, s) => a + (s.benefitsRedeemed || 0), 0);

  return (
    <>
      <p className="sub" style={{ marginBottom: 14 }}>{L('s_intro')}</p>
      <div className="grid g3">
        <Kpi ic="🤝" label={L('k_sponsors')} value={fmt(rows.length)} />
        <Kpi ic="💰" label={L('k_sponsor_rev')} value={`$${fmt(totRev)}${L('mo')}`} />
        <Kpi ic="🎁" label={L('k_benefits')} value={fmt(totRed)} />
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card className="span2">
          <div className="flex between wrap" style={{ gap: 10, marginBottom: 8 }}>
            <b>{L('s_table')}</b>
            <button className="btn sm" onClick={() => setDialog({ kind: 'form' })}>+ {L('s_add')}</button>
          </div>
          {rows.length === 0 ? <EmptyState msg={L('s_no_sponsors')} ic="🤝" /> : (
            <div className="tbl-wrap"><table>
              <thead><tr>
                <th>{L('sp_name')}</th><th>{L('sp_tier')}</th><th>{L('sp_monthly')}</th>
                <th>{L('sp_offered')}</th><th>{L('sp_redeemed')}</th><th>{L('sp_status')}</th><th />
              </tr></thead>
              <tbody>{rows.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td><span className="tag">{s.tier}</span></td>
                  <td>${fmt(s.monthlyFee)}</td>
                  <td>{s.benefitsOffered ?? 0}</td>
                  <td>{fmt(s.benefitsRedeemed)}</td>
                  <td><StatusPill state={s.status} L={L} /></td>
                  <td><div className="row-acts">
                    <button className="btn sec sm" onClick={() => setDialog({ kind: 'form', sponsor: s })}>{L('edit')}</button>
                    <button className="btn dgr sm" onClick={() => setDialog({ kind: 'delete', sponsor: s })}>🗑</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {err && <ErrorBox msg={err} onRetry={load} L={L} />}
        </Card>

        {rows.length > 0 && (
          <Card className="span2">
            <b>{L('s_rev_chart')}</b>
            <HBars data={rows.map((s) => ({
              label: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
              value: s.monthlyFee, disp: `$${fmt(s.monthlyFee)}`,
            }))} />
          </Card>
        )}
      </div>

      {dialog?.kind === 'form' && (
        <SponsorForm sponsor={dialog.sponsor} ctx={ctx} busy={busy}
          onClose={() => setDialog(null)} onSave={save} />
      )}

      {dialog?.kind === 'delete' && (
        <Confirm danger title={L('s_delete_title')} message={L('s_delete_msg', { name: dialog.sponsor.name })}
          confirmLabel={L('s_deactivate')} cancelLabel={L('cancel')} busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => run(() => api.del(`/sponsors/${dialog.sponsor.id}`), L('s_deactivated_ok'))} />
      )}

      <Toast toast={t.toast} onDone={t.clear} />
    </>
  );
}

function SponsorForm({ sponsor, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const [f, setF] = useState(() => ({
    name: sponsor?.name || '',
    tier: sponsor?.tier || 'Bronze',
    monthlyFee: sponsor?.monthlyFee ?? '',
    status: sponsor?.status || 'ok',
    benefitsOffered: sponsor?.benefitsOffered ?? 0,
    benefits: sponsor?.benefits || [],
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const setBenefit = (index, key, value) => setF(s => ({
    ...s, benefits: s.benefits.map((benefit, i) => i === index ? { ...benefit, [key]: value } : benefit),
  }));

  return (
    <Modal busy={busy} title={sponsor ? L('s_edit') : L('s_new')} subtitle={sponsor?.id} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={() => onSave(f, sponsor)} disabled={busy}>{busy ? '…' : (sponsor ? L('save') : L('create'))}</button>
      </>}>
      <FormGrid>
        <Field wide label={`${L('sp_name')} *`}><input maxLength={200} value={f.name} onChange={(e) => set('name')(e.target.value)} /></Field>
        <Field label={`${L('sp_tier')} *`}>
          <Select value={f.tier} onChange={set('tier')} options={TIERS.map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label={`${L('sp_monthly')} (CLP) *`}>
          <input type="number" min="0" step="any" value={f.monthlyFee} onChange={(e) => set('monthlyFee')(e.target.value)} />
        </Field>
        {sponsor ? (
          <>
            <Field label={L('sp_status')}>
              <Select value={f.status} onChange={set('status')} options={STATUSES.map((x) => ({ value: x, label: L(`st_${x}`) }))} />
            </Field>
            <Field label={L('s_offered_num')} hint={L('s_offered_hint')}>
              <input type="number" min="0" step="1" value={f.benefitsOffered} onChange={(e) => set('benefitsOffered')(e.target.value)} />
            </Field>
          </>
        ) : (
          <Field wide label={L('s_benefits')} hint={L('s_benefits_hint')}>
            {f.benefits.map((benefit, index) => (
              <fieldset key={index} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, margin: '0 0 12px', minWidth: 0 }}>
                <legend>{L('s_benefit')} {index + 1}</legend>
                <FormGrid>
                  <Field wide label={`${L('s_benefit_name')} *`}>
                    <input maxLength={200} value={benefit.name} onChange={e => setBenefit(index, 'name', e.target.value)} />
                  </Field>
                  <Field wide label={L('s_benefit_description')}>
                    <textarea maxLength={2000} value={benefit.description} onChange={e => setBenefit(index, 'description', e.target.value)} />
                  </Field>
                  <Field label={`${L('s_benefit_cost')} *`}>
                    <input type="number" min="0" step="1" value={benefit.costPlatinum} onChange={e => setBenefit(index, 'costPlatinum', e.target.value)} />
                  </Field>
                  <Field label={`${L('s_benefit_stock')} *`}>
                    <input type="number" min="0" step="1" value={benefit.stock} onChange={e => setBenefit(index, 'stock', e.target.value)} />
                  </Field>
                </FormGrid>
                <button type="button" className="btn dgr sm" disabled={busy}
                  onClick={() => set('benefits')(f.benefits.filter((_, i) => i !== index))}>{L('s_remove_benefit')}</button>
              </fieldset>
            ))}
            <button type="button" className="btn sec sm" disabled={busy}
              onClick={() => set('benefits')([...f.benefits, { name: '', description: '', costPlatinum: '', stock: '' }])}>
              + {L('s_add_benefit')}
            </button>
          </Field>
        )}
      </FormGrid>
    </Modal>
  );
}
