'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const client = require('prom-client');
const { updateTicketMetrics } = require('../../src/middleware/metrics');

test('las métricas de dominio muestran activos, vencidos y tiempo medio hasta cierre', async () => {
  const db = {
    $queryRaw: async () => [{ active: 7, overdue: 2, average_seconds: 91.5 }],
  };
  const snapshot = await updateTicketMetrics(db);
  assert.equal(snapshot.active, 7);
  assert.equal(snapshot.overdue, 2);
  assert.equal(snapshot.average_seconds, 91.5);

  const exposition = await client.register.metrics();
  assert.match(exposition, /mesa_ayuda_tickets_active 7/);
  assert.match(exposition, /mesa_ayuda_tickets_overdue 2/);
  assert.match(exposition, /mesa_ayuda_ticket_time_to_close_seconds_avg 91\.5/);
});
