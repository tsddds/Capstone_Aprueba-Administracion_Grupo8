import { bodyObject, text, invalid, identifier } from '../../lib/admin-validation.js';
export const planFields = ['name','price','color','features','limits','badges'];
function counters(value, field, defaults) {
  bodyObject(value, Object.keys(defaults));
  const result = { ...defaults, ...value };
  for (const [k,v] of Object.entries(result)) if (!Number.isSafeInteger(v) || v < 0) invalid(field+'.'+k, 'Se requiere un entero no negativo');
  return result;
}
export function validatePlan(input, previous = null) {
  bodyObject(input, planFields);
  if (previous && !Object.keys(input).length) invalid(null, 'Debe indicar un cambio');
  const p = { ...(previous || {}), ...input };
  const name = text(p.name, 'name', 120);
  if (!Number.isSafeInteger(p.price) || p.price < 0 || p.price > 99999999) invalid('price', 'Precio CLP entero entre 0 y 99999999');
  const color = p.color === undefined ? '#6366F1' : p.color;
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) invalid('color');
  const features = p.features === undefined ? [] : p.features;
  if (!Array.isArray(features) || features.length > 100 || new Set(features).size !== features.length) invalid('features');
  for (const id of features) identifier(id, 'features');
  if (input.limits !== undefined) bodyObject(input.limits,['qDay','groups','tests']);
  if (input.badges !== undefined) bodyObject(input.badges,['login','purchase','correct']);
  return { name, price:p.price, color, features,
    limits:counters({...previous?.limits,...input.limits}, 'limits', {qDay:0,groups:0,tests:1}),
    badges:counters({...previous?.badges,...input.badges}, 'badges', {login:0,purchase:0,correct:0}) };
}
