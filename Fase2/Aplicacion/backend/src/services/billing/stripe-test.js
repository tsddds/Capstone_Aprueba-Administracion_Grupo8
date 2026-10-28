import { AdminError } from '../../lib/admin-validation.js';
import { assertEmulatorOnly } from '../../../dev/safety.mjs';
const unavailable = () => new AdminError(503, 'STRIPE_UNAVAILABLE', 'No se pudo sincronizar el precio con Stripe de pruebas; reintente la misma solicitud');
// Transporte inyectable desde tests de servicio; la URL nunca procede del usuario.
export function stripeTestClient({ key = process.env.STRIPE_TEST_SECRET_KEY, transport = fetch } = {}) {
  let origin = 'https://api.stripe.com';
  if (process.env.STRIPE_TEST_API_ORIGIN) {
    assertEmulatorOnly(process.env, {testOnly:true});
    if (process.env.NODE_ENV !== 'test' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.STRIPE_TEST_API_ORIGIN))
      throw new AdminError(503,'STRIPE_NOT_CONFIGURED','El proveedor simulado solo se admite en tests aislados');
    origin = process.env.STRIPE_TEST_API_ORIGIN;
  }
  if (typeof key !== 'string' || !/^sk_test_[A-Za-z0-9_]+$/.test(key))
    throw new AdminError(503, 'STRIPE_NOT_CONFIGURED', 'Se requiere una clave privada de Stripe en modo de pruebas');
  async function post(path, fields, idempotencyKey) {
    try {
      const r = await transport(origin+'/v1/'+path, { method:'POST', redirect:'error', signal:AbortSignal.timeout(7000),
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotencyKey}, body:new URLSearchParams(fields).toString() });
      if (!r.ok) throw unavailable();
      const value = await r.json();
      if (!value || value.livemode !== false || typeof value.id !== 'string') throw unavailable();
      return value;
    } catch { throw unavailable(); }
  }
  return {
    async syncPrice({ planId, price, operationId, productId }) {
      const product = productId ? {id:productId} : await post('products', {name:'Plan '+planId,'metadata[apruebaPlanId]':planId}, operationId+'-product');
      if (!/^prod_\w+$/.test(product.id)) throw unavailable();
      const result = await post('prices', {currency:'clp',unit_amount:String(price),'recurring[interval]':'month',product:product.id,'metadata[apruebaPlanId]':planId}, operationId+'-price');
      if (!/^price_\w+$/.test(result.id) || result.currency !== 'clp' || result.unit_amount !== price || result.product !== product.id || result.recurring?.interval !== 'month') throw unavailable();
      return { productId:product.id, priceId:result.id, mode:'test', currency:'CLP', interval:'month' };
    }
  };
}
