const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const { prisma } = require('../../src/db');
const ticketService = require('../../src/services/ticketService');

const now = new Date('2026-11-10T10:00:00.000Z');

function ticket() {
  return {
    id: 'ticket-1',
    version: 3,
    estado: 'EN_PROGRESO',
    prioridad: 'CRITICA',
    nivelActual: 'N1',
    venceSlaAt: new Date('2026-11-10T13:00:00.000Z'),
    agenteAsignado: { id: 'agent-1', nivel: 'N1', activo: true },
    slaPolicy: { minutosPrimeraRespuesta: 15, minutosResolucion: 240 },
  };
}

test('escalamiento registra cambio y evento de outbox en una transaccion serializable', async () => {
  const steps = [];
  const current = ticket();
  const destination = { id: 'agent-2', nivel: 'N2', activo: true };
  const updated = { ...current, nivelActual: 'N2', estado: 'ESCALADO', version: 4 };
  let readCount = 0;
  const tx = {
    ticket: {
      findUnique: async () => (++readCount === 1 ? current : updated),
      updateMany: async (query) => {
        steps.push('update');
        assert.deepEqual(query.where, { id: current.id, version: 3 });
        assert.equal(query.data.nivelActual, 'N2');
        return { count: 1 };
      },
    },
    agente: {
      findFirst: async (query) => {
        assert.deepEqual(query.where, { nivel: 'N2', activo: true });
        return destination;
      },
    },
    escalamiento: {
      create: async ({ data }) => {
        steps.push('escalation');
        assert.equal(data.ticketId, current.id);
        assert.equal(data.agenteDestinoId, destination.id);
        return { id: 'escalation-1', ...data };
      },
    },
    eventoOutbox: {
      create: async ({ data }) => {
        steps.push('outbox');
        assert.equal(data.tipo, 'ticket.escalado');
        assert.equal(data.correlationId, 'correlation-1');
        assert.equal(data.payload.nivelDestino, 'N2');
        return { id: 'event-1' };
      },
    },
  };
  const transaction = mock.method(prisma, '$transaction', async (callback, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    return callback(tx);
  });
  try {
    const result = await ticketService.escalate(current.id, { motivo: 'SLA critico' }, 'correlation-1', now);
    assert.deepEqual(steps, ['escalation', 'update', 'outbox']);
    assert.equal(result.ticket, updated);
    assert.equal(result.eventId, 'event-1');
  } finally {
    transaction.mock.restore();
  }
});

test('una version concurrente rechaza el escalamiento sin registrar evento', async () => {
  let eventCreated = false;
  const tx = {
    ticket: {
      findUnique: async () => ticket(),
      updateMany: async () => ({ count: 0 }),
    },
    agente: { findFirst: async () => ({ id: 'agent-2', nivel: 'N2', activo: true }) },
    escalamiento: { create: async () => ({ id: 'escalation-1' }) },
    eventoOutbox: { create: async () => { eventCreated = true; } },
  };
  const transaction = mock.method(prisma, '$transaction', async (callback) => callback(tx));
  try {
    await assert.rejects(
      ticketService.escalate('ticket-1', { motivo: 'SLA critico' }, 'correlation-1', now),
      (error) => error.status === 409 && /concurrentemente/.test(error.message)
    );
    assert.equal(eventCreated, false);
  } finally {
    transaction.mock.restore();
  }
});

test('cierre registra resolucion, estado y evento en una misma transaccion', async () => {
  const steps = [];
  const tx = {
    ticket: {
      findUnique: async () => ({ id: 'ticket-1', estado: 'RESUELTO' }),
      update: async ({ data }) => {
        steps.push('update');
        assert.equal(data.estado, 'CERRADO');
        assert.equal(data.cerradoEn, now);
        return { id: 'ticket-1', estado: 'CERRADO' };
      },
    },
    comentario: {
      create: async ({ data }) => {
        steps.push('comment');
        assert.match(data.texto, /Resolucion: reinicio/);
      },
    },
    eventoOutbox: {
      create: async ({ data }) => {
        steps.push('outbox');
        assert.equal(data.tipo, 'ticket.cerrado');
        assert.equal(data.payload.resolucion, 'reinicio');
        return { id: 'event-2' };
      },
    },
  };
  const transaction = mock.method(prisma, '$transaction', async (callback, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    return callback(tx);
  });
  try {
    const result = await ticketService.close('ticket-1', { resolucion: 'reinicio' }, 'correlation-1', now);
    assert.deepEqual(steps, ['comment', 'update', 'outbox']);
    assert.equal(result.eventId, 'event-2');
  } finally {
    transaction.mock.restore();
  }
});
