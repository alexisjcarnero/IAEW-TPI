const assert = require('node:assert/strict');

// Prueba de la transaccion y el flujo asincronico reales sin depender de Auth0.
// Usa la base expuesta por Compose; se puede sobrescribir DATABASE_URL.
process.env.DATABASE_URL ||= 'postgresql://iaew:iaew-local@localhost:5432/iaew_mesa_ayuda?schema=public';

const { prisma } = require('../src/db');
const ticketService = require('../src/services/ticketService');

async function main() {
  const runId = Date.now();
  const user = await prisma.usuario.create({
    data: { nombre: 'Smoke solicitante', email: `smoke-user-${runId}@iaew.local` },
  });
  const agentN1 = await prisma.agente.create({
    data: { nombre: 'Smoke N1', email: `smoke-n1-${runId}@iaew.local`, nivel: 'N1' },
  });
  const agentN2 = await prisma.agente.create({
    data: { nombre: 'Smoke N2', email: `smoke-n2-${runId}@iaew.local`, nivel: 'N2' },
  });

  const created = await ticketService.create({
    titulo: 'Smoke flujo asincronico',
    descripcion: 'Prueba real de transaccion, outbox, broker, worker y webhook.',
    prioridad: 'CRITICA',
    solicitanteId: user.id,
  });
  const assigned = await ticketService.assign(created.id, agentN1.id);
  assert.equal(assigned.estado, 'ASIGNADO');
  const correlationId = `smoke-business-${runId}`;
  const escalation = await ticketService.escalate(
    created.id,
    { agenteDestinoId: agentN2.id, motivo: 'Smoke prioridad critica' },
    correlationId
  );
  assert.equal(escalation.ticket.estado, 'ESCALADO');
  assert.equal(escalation.ticket.nivelActual, 'N2');

  let notification;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    notification = await prisma.notificacion.findUnique({ where: { eventoId: escalation.eventId } });
    if (notification?.estado === 'ENVIADA') break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(notification?.estado, 'ENVIADA', 'el worker no confirmo la notificacion en 30 s');
  assert.equal(notification.webhookStatus, 202);

  const event = await prisma.eventoOutbox.findUnique({ where: { id: escalation.eventId } });
  assert.ok(event.publicadoEn, 'el evento no fue marcado como publicado');
  const response = await fetch(
    `${process.env.WEBHOOK_BASE_URL || 'http://localhost:4000'}/webhooks/mesa-ayuda/recepciones`
  );
  assert.equal(response.status, 200);
  const receptions = await response.json();
  assert.ok(receptions.data.some((item) => item.eventId === escalation.eventId));

  await ticketService.update(created.id, { estado: 'EN_PROGRESO' });
  await ticketService.update(created.id, { estado: 'RESUELTO' });
  const closure = await ticketService.close(
    created.id,
    { resolucion: 'Smoke: servicio restaurado' },
    correlationId
  );
  assert.equal(closure.ticket.estado, 'CERRADO');

  let closingNotification;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    closingNotification = await prisma.notificacion.findUnique({ where: { eventoId: closure.eventId } });
    if (closingNotification?.estado === 'ENVIADA') break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(closingNotification?.estado, 'ENVIADA', 'el cierre no se notifico en 30 s');
  assert.equal(closingNotification.webhookStatus, 202);
  const closingReceptions = await (await fetch(
    `${process.env.WEBHOOK_BASE_URL || 'http://localhost:4000'}/webhooks/mesa-ayuda/recepciones`
  )).json();
  assert.ok(closingReceptions.data.some((item) => item.eventId === closure.eventId));

  console.log(JSON.stringify({
    ticketId: created.id,
    escalationEventId: escalation.eventId,
    closingEventId: closure.eventId,
    correlationId,
    ticketState: closure.ticket.estado,
    notifications: [notification.estado, closingNotification.estado],
    webhookStatuses: [notification.webhookStatus, closingNotification.webhookStatus],
    receivedBoth: true,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
