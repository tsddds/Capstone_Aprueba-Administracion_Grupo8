// Datos ficticios para desarrollo y pruebas en los emuladores locales.
export function buildFixtures(now = new Date()) {
  const asOf = now.toISOString();
  const ago = days => new Date(now.getTime() - days * 86400000).toISOString();
  const baseUser = (id, plan, days, state = 'active') => ({ id, name: `Alumno ficticio ${id.slice(-2)}`,
    email: `${id}@example.test`, country: 'CL', plan, state, lastActivity: ago(days),
    createdAt: ago(100), badges: 10, medals: { bronze: 10, silver: 0, gold: 0, diamond: 0, platinum: 0 },
    devices: [], recentActivity: [], groups: 0 });
  const users = [baseUser('usr_demo_01', 'free', 2), baseUser('usr_demo_02', 'uni', 10),
    baseUser('usr_demo_03', 'all', 29), baseUser('usr_demo_04', 'all', 31),
    baseUser('usr_demo_05', 'free', 60, 'suspended'), baseUser('usr_demo_06', 'free', 0),
    baseUser('usr_demo_07', 'free', 90, 'churned')];
  const subscriptions = [
    { id: 'sub_demo_uni', userId: 'usr_demo_02', plan: 'uni', status: 'active', billingCycle: 'monthly', currentPeriodEnd: ago(-20) },
    { id: 'sub_demo_all', userId: 'usr_demo_03', plan: 'all', status: 'active', billingCycle: 'monthly', currentPeriodEnd: ago(-20) },
    { id: 'sub_demo_canceled', userId: 'usr_demo_04', plan: 'all', status: 'canceled', billingCycle: 'monthly', currentPeriodEnd: ago(10) },
  ];
  for (const u of users) u.subscription = subscriptions.find(s => s.userId === u.id) || null;
  const questions = [
    { id: 'qst_demo_01', testId: 'm1', axis: 'Álgebra', difficulty: 'd1', statement: '¿Cuánto vale x si 2x = 10?', options: ['2', '3', '5', '8', '10'], correctAnswer: 'C', explanation: 'Dividir ambos lados por dos.', requiredSkill: 'Resolver ecuaciones', status: 'published' },
    { id: 'qst_demo_02', testId: 'm1', axis: 'Números', difficulty: 'd2', statement: '¿Cuánto es 3 + 4?', options: ['4', '5', '6', '7', '8'], correctAnswer: 'C', explanation: 'Ejemplo con error intencional para recorrección: debería ser D.', requiredSkill: 'Sumar', status: 'flagged' },
    { id: 'qst_demo_03', testId: 'm2', axis: 'Álgebra', difficulty: 'd3', statement: '¿Cuánto es 2 al cuadrado?', options: ['1', '2', '3', '4', '5'], correctAnswer: 'D', explanation: '2 por 2.', requiredSkill: 'Potencias', status: 'draft' },
  ];
  const plans = [
    { id: 'free', name: 'Gratis ficticio', price: 0, color: '#64748B', features: ['f3'], limits: { qDay: 20, groups: 1, tests: 1 } },
    { id: 'uni', name: 'Una prueba ficticia', price: 3000, color: '#6366F1', features: ['f1', 'f3'], limits: { qDay: 0, groups: 3, tests: 1 } },
    { id: 'all', name: 'Todas ficticio', price: 5000, color: '#0891B2', features: ['f1', 'f2', 'f3'], limits: { qDay: 0, groups: 0, tests: 0 } },
    { id: 'pl_demo_empty', name: 'Plan sin suscriptores ficticio', price: 1000, color: '#6366F1', features: ['f3'], limits: { qDay: 30, groups: 1, tests: 1 } },
  ];
  const sponsors = [
    { id: 'spo_demo_01', name: 'Librería ficticia Uno', tier: 'Gold', monthlyFee: 2000, status: 'ok', benefitsOffered: 1, benefitsRedeemed: 2,
      benefits: [{ id: 'ben_demo_01', name: 'Cuaderno ficticio', description: 'No canjeable fuera de pruebas', costPlatinum: 5, stock: 10, active: true }] },
    { id: 'spo_demo_02', name: 'Marca ficticia Dos', tier: 'Silver', monthlyFee: 1000, status: 'deg', benefitsOffered: 0, benefitsRedeemed: 0, benefits: [] },
  ];
  // Los siguientes documentos son snapshots iniciales para la UI heredada.
  // No implementan los cálculos periódicos del backend ni métricas reales.
  const revenueByPlan = [{ plan: 'uni', value: 3000 }, { plan: 'all', value: 5000 }];
  const fixtureMeta = { source: 'fixture_snapshot_not_live', generatedAt: asOf };
  const records = {
    features: [{ id: 'f1', name: 'Preguntas ilimitadas' }, { id: 'f2', name: 'Modo ensayo' }, { id: 'f3', name: 'Explicaciones' }],
    plans, users, subscriptions, sponsors, questions,
    tickets: ['open', 'progress', 'closed'].map((state, i) => ({ id: `tkt_demo_0${i + 1}`, userId: 'usr_demo_01', user: users[0].name,
      subject: `Consulta ficticia ${i + 1}`, state, priority: ['high', 'med', 'low'][i], age: '2 h', createdAt: ago(1), assigneeId: null })),
    corrections: ['pending', 'confirmed', 'rejected'].map((state, i) => ({ id: `cor_demo_0${i + 1}`, userId: 'usr_demo_01', questionId: 'qst_demo_02', state,
      reason: 'wrong_answer', comment: 'La alternativa debería ser D. Ejemplo ficticio.', createdAt: ago(1) })),
    platforms: ['Android', 'iOS', 'Web'].map((platform, i) => ({ id: `platform_demo_${i}`, platform: `${platform} (datos ficticios)`, version: '0.1.0-demo', available: true, downloads: [60, 40, 0][i], updatedAt: asOf.slice(0, 10), source: 'fixture' })),
    services: [{ id: 'svc_demo', key: 'fixture', name: 'Servicio FICTICIO sin monitorización', state: 'down', uptime: 'Sin medición', latency: null, source: 'fixture_not_measured' }],
    containers: [{ id: 'container-demo', name: 'container-demo', state: 'down', cpu: 0, mem: 0, region: 'fixture-no-real', source: 'fixture_not_measured' }],
    appConfig: [{ id: 'metrics', metricsRefreshSeconds: 300, dashboardPollSeconds: 60, timeZone: 'America/Santiago', currency: 'CLP' }],
    metrics: [
      { id: 'overview', downloads: { total: 100, month: 20, deltaPct: 0 }, mau: { value: 4, deltaPct: 0 }, converted: { value: 2, rate: 50 },
        mrr: { value: 8000, deltaPct: 0 }, badgesIssued: 70, sponsorsActive: 1, downloadsByMonth: [{ month: asOf.slice(0, 7), value: 20 }],
        revenueByPlan, systemHealth: { status: 'sin_medicion_real', servicesDown: 1 }, ...fixtureMeta },
      { id: 'commercial', downloads: 100, dau: 1, mau: 4, converted: 2, convRate: 50, mrr: 8000, benefitsRedeemed: 2, revenueByPlan,
        funnel: [{ label: 'Descargas', value: 100 }, { label: 'Registrados', value: 7 }, { label: 'Activos', value: 4 }, { label: 'Convertidos', value: 2 }],
        badgesByType: [{ tier: 'bronze', value: 70 }], ...fixtureMeta },
    ],
    // Entradas internas propuestas para que el equipo implemente el cálculo.
    downloadEvents: [{ id: 'download_demo_old', count: 80, platform: 'Android', occurredAt: ago(40) }, { id: 'download_demo_new', count: 20, platform: 'iOS', occurredAt: asOf }],
    payments: subscriptions.filter(s => s.status === 'active').map((s, i) => ({ id: `pay_demo_${i}`, userId: s.userId, plan: s.plan, status: 'paid', amount: i === 0 ? 3000 : 5000, currency: 'CLP', paidAt: asOf, source: 'fixture_not_stripe' })),
    devMeta: [{ id: 'dataset-v1', version: 1, asOf, description: 'Datos ficticios para desarrollo aislado; no usar en nube.' }],
  };
  return records;
}
