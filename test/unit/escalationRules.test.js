const test = require('node:test');
const assert = require('node:assert/strict');

const { nextLevel, validateEscalationEligibility } = require('../../src/services/escalationRules');

function validTicket(overrides = {}) {
  return {
    estado: 'EN_PROGRESO',
    prioridad: 'CRITICA',
    nivelActual: 'N1',
    venceSlaAt: new Date('2026-11-10T13:00:00.000Z'),
    agenteAsignado: { id: 'agent-1', nivel: 'N1', activo: true },
    slaPolicy: { minutosPrimeraRespuesta: 15, minutosResolucion: 240 },
    ...overrides,
  };
}

test('calcula solamente el siguiente nivel permitido', () => {
  assert.equal(nextLevel('N1'), 'N2');
  assert.equal(nextLevel('N2'), 'N3');
  assert.equal(nextLevel('N3'), null);
});

test('permite escalar prioridad critica de N1 a N2 inmediatamente', () => {
  const result = validateEscalationEligibility(validTicket(), new Date('2026-11-10T10:00:00.000Z'));
  assert.equal(result.nivelDestino, 'N2');
});

test('rechaza tickets cerrados', () => {
  assert.throws(
    () => validateEscalationEligibility(validTicket({ estado: 'CERRADO' })),
    (error) => error.status === 409 && /estado actual/.test(error.message)
  );
});

test('rechaza responsable inactivo o de nivel incorrecto', () => {
  assert.throws(
    () => validateEscalationEligibility(validTicket({ agenteAsignado: { nivel: 'N1', activo: false } })),
    /responsable activo/
  );
  assert.throws(
    () => validateEscalationEligibility(validTicket({ agenteAsignado: { nivel: 'N2', activo: true } })),
    /nivel del responsable/
  );
});

test('prioridad baja solo escala cuando entra en ventana de riesgo SLA', () => {
  const low = validTicket({
    prioridad: 'BAJA',
    venceSlaAt: new Date('2026-11-10T13:00:00.000Z'),
    slaPolicy: { minutosPrimeraRespuesta: 60, minutosResolucion: 240 },
  });
  assert.throws(
    () => validateEscalationEligibility(low, new Date('2026-11-10T10:00:00.000Z')),
    /riesgo de SLA/
  );
  assert.equal(
    validateEscalationEligibility(low, new Date('2026-11-10T12:30:00.000Z')).nivelDestino,
    'N2'
  );
});

test('rechaza SLA mal configurado y el intento de superar N3', () => {
  assert.throws(
    () => validateEscalationEligibility(validTicket({ slaPolicy: { minutosPrimeraRespuesta: 0, minutosResolucion: 1 } })),
    /SLA mal configurado/
  );
  assert.throws(
    () =>
      validateEscalationEligibility(
        validTicket({ nivelActual: 'N3', agenteAsignado: { nivel: 'N3', activo: true } })
      ),
    /nivel maximo/
  );
});
