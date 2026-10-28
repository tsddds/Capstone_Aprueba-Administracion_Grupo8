// Una cuenta activa no prueba vigencia de su suscripción.
export function activeSubscription(s, at = Date.now()) {
  const end = Date.parse(s.currentPeriodEnd);
  const start = s.currentPeriodStart == null ? -Infinity : Date.parse(s.currentPeriodStart);
  return s.status === 'active' && Number.isFinite(end) && end > at && start <= at;
}
// Si falta el vencimiento de una suscripción marcada activa, no asumir que es seguro borrar.
export function subscriptionBlocksDeletion(s, at = Date.now()) {
  const end = Date.parse(s.currentPeriodEnd);
  return s.status === 'active' && (!Number.isFinite(end) || end > at);
}
