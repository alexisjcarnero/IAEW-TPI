const { prisma } = require('../db');
const config = require('../config');
const rabbit = require('./rabbit');

let timer = null;
let running = false;

async function flushOnce(logger, eventIds) {
  if (running) return 0;
  running = true;
  let published = 0;
  try {
    const events = await prisma.eventoOutbox.findMany({
      where: {
        publicadoEn: null,
        ...(eventIds?.length && { id: { in: eventIds } }),
      },
      orderBy: { creadoEn: 'asc' },
      take: 20,
    });

    for (const stored of events) {
      const event = {
        id: stored.id,
        type: stored.tipo,
        subject: `ticket/${stored.agregadoId}`,
        occurredAt: stored.payload.occurredAt || stored.creadoEn.toISOString(),
        correlationId: stored.correlationId,
        data: stored.payload,
      };
      try {
        await rabbit.publishEvent(stored.tipo, event);
        await prisma.eventoOutbox.update({
          where: { id: stored.id },
          data: { publicadoEn: new Date(), intentos: { increment: 1 } },
        });
        published += 1;
        logger?.info({ eventId: stored.id, type: stored.tipo }, 'Evento outbox publicado');
      } catch (error) {
        await prisma.eventoOutbox
          .update({ where: { id: stored.id }, data: { intentos: { increment: 1 } } })
          .catch(() => {});
        logger?.warn({ err: error, eventId: stored.id }, 'Evento pendiente en outbox');
        break;
      }
    }
  } finally {
    running = false;
  }
  return published;
}

function start(logger) {
  if (timer) return;
  flushOnce(logger).catch((error) => logger?.error({ err: error }, 'Error leyendo outbox'));
  timer = setInterval(() => {
    flushOnce(logger).catch((error) => logger?.error({ err: error }, 'Error leyendo outbox'));
  }, config.rabbit.outboxPollMs);
  timer.unref?.();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, flushOnce };
