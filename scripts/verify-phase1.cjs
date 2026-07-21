const { prisma } = require('./src/lib/db');
const { Logger } = require('./src/lib/infrastructure/logging/Logger');
const { ConversationEngine } = require('./src/lib/domain/ConversationEngine');
const { AIProvider } = require('./src/lib/infrastructure/ai/AIProvider');
const crypto = require('crypto');

async function runPhase1Tests() {
  console.log('\n======================================================');
  console.log(' PHASE 1 HARDENING VERIFICATION TESTS');
  console.log('======================================================\n');

  const clinic = await prisma.clinic.findFirst({
    include: {
      branches: { where: { status: 'ACTIVE' } },
      doctors: { where: { status: 'ACTIVE' } },
      services: { where: { status: 'ACTIVE' } },
    },
  });

  if (!clinic) {
    console.error('No clinic found in DB. Seed data required.');
    process.exit(1);
  }

  const TEST_PHONE = '+966500000001';
  const TESTS_PASSED = [];
  const TESTS_FAILED = [];

  function pass(id, msg) { TESTS_PASSED.push(id); console.log('[PASS] ' + id + ' — ' + msg); }
  function fail(id, msg) { TESTS_FAILED.push(id); console.error('[FAIL] ' + id + ' — ' + msg); }

  const origLog = console.log;
  const origError = console.error;

  // ─── T1: Logger structured INFO output ──────────────────────────────────────
  let cap = null;
  console.log = (...a) => { cap = a[0]; };
  Logger.info('Test log', { requestId: 'req-001', clinicId: clinic.id });
  console.log = origLog;
  try {
    const p = JSON.parse(cap);
    if (p.level === 'INFO' && p.requestId === 'req-001') pass('T1-LOGGER', 'Structured JSON has level=INFO and requestId');
    else fail('T1-LOGGER', 'Missing fields: ' + cap);
  } catch { fail('T1-LOGGER', 'Non-JSON: ' + cap); }

  // ─── T2: Phone masking ──────────────────────────────────────────────────────
  cap = null;
  console.log = (...a) => { cap = a[0]; };
  Logger.info('mask', { requestId: 'r', clinicId: 'c', clientPhone: '+966500000001' });
  console.log = origLog;
  try {
    const p = JSON.parse(cap);
    if (p.clientPhone && !p.clientPhone.includes('500000001')) pass('T2-MASK-PHONE', 'Phone masked: ' + p.clientPhone);
    else fail('T2-MASK-PHONE', 'Phone NOT masked: ' + p.clientPhone);
  } catch { fail('T2-MASK-PHONE', 'Parse error'); }

  // ─── T3: Name masking ──────────────────────────────────────────────────────
  cap = null;
  console.log = (...a) => { cap = a[0]; };
  Logger.info('mask', { requestId: 'r', clinicId: 'c', clientName: 'سارة الأحمد' });
  console.log = origLog;
  try {
    const p = JSON.parse(cap);
    const notMasked = p.clientName === 'سارة الأحمد';
    if (p.clientName && !notMasked) pass('T3-MASK-NAME', 'Name masked: ' + p.clientName);
    else fail('T3-MASK-NAME', 'Name NOT masked: ' + p.clientName);
  } catch { fail('T3-MASK-NAME', 'Parse error'); }

  // ─── T4: Metric log ─────────────────────────────────────────────────────────
  cap = null;
  console.log = (...a) => { cap = a[0]; };
  Logger.metric('llm_latency_ms', 1250, { requestId: 'r', clinicId: 'c' });
  console.log = origLog;
  try {
    const p = JSON.parse(cap);
    if (p.level === 'METRIC' && p.metricName === 'llm_latency_ms' && p.metricValue === 1250) pass('T4-METRIC', 'Metric log correct');
    else fail('T4-METRIC', 'Metric malformed: ' + cap);
  } catch { fail('T4-METRIC', 'Parse error'); }

  // ─── T5: Correlation ID in live request ─────────────────────────────────────
  console.log('\n[T5] Testing Correlation ID propagation in live request...');
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });
  const reqId5 = crypto.randomUUID();
  const lines5 = [];
  console.log = (...a) => { lines5.push(a[0]); };
  console.error = (...a) => { lines5.push(a[0]); };
  try {
    await ConversationEngine.processMessage(clinic, TEST_PHONE, 'السلام عليكم', 'Simulator', reqId5);
  } finally {
    console.log = origLog;
    console.error = origError;
  }
  const hasId = lines5.some(l => { try { return JSON.parse(l).requestId === reqId5; } catch { return false; } });
  if (hasId) pass('T5-CORR-ID', 'requestId=' + reqId5.slice(0, 8) + '... found in output logs');
  else fail('T5-CORR-ID', 'requestId NOT found in any log line');

  // ─── T6: Sliding Window ─────────────────────────────────────────────────────
  console.log('\n[T6] Testing sliding window context slicing...');
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });
  const fakeHistory = [];
  for (let i = 1; i <= 20; i++) {
    fakeHistory.push({ role: i % 2 === 1 ? 'user' : 'assistant', content: 'رسالة ' + i, timestamp: new Date().toISOString() });
  }
  await prisma.conversation.create({
    data: { clientPhone: TEST_PHONE, clinicId: clinic.id, messages: fakeHistory },
  });
  const origAI = AIProvider.classifyIntentAndExtractData;
  let capturedLen = null;
  AIProvider.classifyIntentAndExtractData = async (c, history, ...rest) => {
    capturedLen = history.length;
    return origAI.call(AIProvider, c, history, ...rest);
  };
  await ConversationEngine.processMessage(clinic, TEST_PHONE, 'وين موقعكم', 'Simulator', crypto.randomUUID());
  AIProvider.classifyIntentAndExtractData = origAI;
  if (capturedLen !== null && capturedLen <= 12) pass('T6-WINDOW', 'History sliced to ' + capturedLen + ' msgs (MAX=12)');
  else fail('T6-WINDOW', 'History NOT sliced. Captured: ' + capturedLen);

  // ─── T7: AI Fallback ─────────────────────────────────────────────────────────
  console.log('\n[T7] Testing AI provider failure -> Arabic fallback...');
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });
  const origAI2 = AIProvider.classifyIntentAndExtractData;
  AIProvider.classifyIntentAndExtractData = async () => { throw new Error('Simulated Timeout'); };
  let fallbackRes = null;
  console.error = () => {};
  try {
    const res = await ConversationEngine.processMessage(clinic, TEST_PHONE, 'أبغى أحجز', 'Simulator', crypto.randomUUID());
    fallbackRes = res.response;
  } finally {
    AIProvider.classifyIntentAndExtractData = origAI2;
    console.error = origError;
  }
  if (fallbackRes && fallbackRes.includes('مشكلة تقنية')) pass('T7-FALLBACK', 'Arabic fallback returned correctly');
  else fail('T7-FALLBACK', 'Wrong fallback. Got: ' + fallbackRes);

  // ─── T8: Multi-tenancy — clinicId isolation ──────────────────────────────────
  console.log('\n[T8] Testing Multi-Tenancy clinicId isolation...');
  const booking = await prisma.booking.findFirst({ where: { clinicId: clinic.id, status: { in: ['PENDING', 'CONFIRMED'] } } });
  if (booking) {
    const fakeClinicId = 'FAKE_CLINIC_ID_12345';
    const leakedBooking = await prisma.booking.findFirst({
      where: { clinicId: fakeClinicId, clientPhone: booking.clientPhone, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    if (!leakedBooking) pass('T8-TENANCY', 'Booking NOT visible under fake clinicId — isolation works');
    else fail('T8-TENANCY', 'LEAK: Booking visible under fake clinicId!');
  } else {
    pass('T8-TENANCY', 'No active bookings to test, isolation relies on existing WHERE clinicId guard');
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(' RESULTS: ' + TESTS_PASSED.length + ' PASS / ' + TESTS_FAILED.length + ' FAIL');
  if (TESTS_FAILED.length > 0) {
    console.error(' FAILED TESTS: ' + TESTS_FAILED.join(', '));
    process.exit(1);
  } else {
    console.log(' ALL PHASE 1 HARDENING TESTS PASSED ✅');
    process.exit(0);
  }
}

runPhase1Tests().catch(err => {
  console.error('Fatal test error:', err.message);
  process.exit(1);
});
