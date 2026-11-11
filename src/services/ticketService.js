const { prisma } = require('../db');
const { AppError } = require('../http/AppError');
const { notFound, conflict } = require('../http/responses');
const { validateEscalationEligibility } = require('./escalationRules');

const ticketInclude = {
  solicitante: true,
  agenteAsignado: true,
  slaPolicy: true,
};

const STATE_TRANSITIONS = {
  ASIGNADO: new Set(['EN_PROGRESO']),
  EN_PROGRESO: new Set(['RESUELTO']),
  ESCALADO: new Set(['EN_PROGRESO', 'RESUELTO']),
};

function slaDueDate(policy, from = new Date()) {
  return new Date(from.getTime() + policy.minutosResolucion * 60_000);
}

async function list(filters) {
  return prisma.ticket.findMany({
    where: {
      ...(filters.estado && { estado: filters.estado }),
      ...(filters.prioridad && { prioridad: filters.prioridad }),
    },
    include: ticketInclude,
    orderBy: { creadoEn: 'desc' },
    take: filters.limit,
  });
}

async function get(id) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      ...ticketInclude,
      comentarios: { orderBy: { creadoEn: 'asc' } },
      escalamientos: { orderBy: { creadoEn: 'asc' }, include: { agenteDestino: true } },
    },
  });
  if (!ticket) notFound('Ticket');
  return ticket;
}

async function create(data) {
  const [solicitante, policy] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: data.solicitanteId } }),
    prisma.slaPolicy.findUnique({ where: { prioridad: data.prioridad } }),
  ]);
  if (!solicitante) notFound('Usuario solicitante');
  if (!policy) conflict('SLA mal configurado', `No existe politica para ${data.prioridad}.`);

  return prisma.ticket.create({
    data: {
      ...data,
      slaPolicyId: policy.id,
      venceSlaAt: slaDueDate(policy),
    },
    include: ticketInclude,
  });
}

async function update(id, data) {
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.ticket.findUnique({ where: { id }, include: { slaPolicy: true } });
      if (!current) notFound('Ticket');
      if (current.estado === 'CERRADO') conflict('Un ticket cerrado es inmutable');

      if (data.estado) {
        const allowed = STATE_TRANSITIONS[current.estado] || new Set();
        if (!allowed.has(data.estado)) {
          conflict('Transicion de estado invalida', `${current.estado} -> ${data.estado} no esta permitida.`);
        }
      }

      const updateData = { ...data, version: { increment: 1 } };
      if (data.prioridad && data.prioridad !== current.prioridad) {
        if (current.estado === 'RESUELTO') conflict('No se puede cambiar la prioridad de un ticket resuelto');
        const policy = await tx.slaPolicy.findUnique({ where: { prioridad: data.prioridad } });
        if (!policy) conflict('SLA mal configurado', `No existe politica para ${data.prioridad}.`);
        updateData.slaPolicyId = policy.id;
        updateData.venceSlaAt = slaDueDate(policy, current.creadoEn);
      }

      return tx.ticket.update({ where: { id }, data: updateData, include: ticketInclude });
    },
    { isolationLevel: 'Serializable' }
  );
}

async function remove(id) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id },
      include: { _count: { select: { comentarios: true, escalamientos: true, notificaciones: true } } },
    });
    if (!ticket) notFound('Ticket');
    if (ticket.estado !== 'ABIERTO') {
      conflict('Solo se puede eliminar un ticket ABIERTO', 'Los tickets procesados se conservan por auditoria.');
    }
    if (Object.values(ticket._count).some((count) => count > 0)) {
      conflict('El ticket tiene historial asociado y no puede eliminarse');
    }
    await tx.ticket.delete({ where: { id } });
  });
}

async function assign(id, agenteId) {
  return prisma.$transaction(
    async (tx) => {
      const [ticket, agent] = await Promise.all([
        tx.ticket.findUnique({ where: { id } }),
        tx.agente.findUnique({ where: { id: agenteId } }),
      ]);
      if (!ticket) notFound('Ticket');
      if (!agent) notFound('Agente');
      if (!agent.activo) conflict('El agente esta inactivo');
      if (['RESUELTO', 'CERRADO'].includes(ticket.estado)) conflict('El ticket ya no admite asignaciones');
      if (agent.nivel !== ticket.nivelActual) {
        conflict('Nivel de agente incompatible', `Se requiere un agente ${ticket.nivelActual}.`);
      }
      return tx.ticket.update({
        where: { id },
        data: {
          agenteAsignadoId: agenteId,
          estado: ticket.estado === 'ABIERTO' ? 'ASIGNADO' : ticket.estado,
          version: { increment: 1 },
        },
        include: ticketInclude,
      });
    },
    { isolationLevel: 'Serializable' }
  );
}

async function escalate(id, input, correlationId, now = new Date()) {
  return prisma.$transaction(
    async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id },
        include: { agenteAsignado: true, slaPolicy: true },
      });
      if (!ticket) notFound('Ticket');

      const { nivelDestino } = validateEscalationEligibility(ticket, now);
      const agenteDestino = input.agenteDestinoId
        ? await tx.agente.findUnique({ where: { id: input.agenteDestinoId } })
        : await tx.agente.findFirst({
            where: { nivel: nivelDestino, activo: true },
            orderBy: { creadoEn: 'asc' },
          });

      if (!agenteDestino) notFound('Agente de destino');
      if (!agenteDestino.activo || agenteDestino.nivel !== nivelDestino) {
        conflict('Agente de destino incompatible', `Se requiere un agente activo ${nivelDestino}.`);
      }

      const escalation = await tx.escalamiento.create({
        data: {
          ticketId: ticket.id,
          nivelOrigen: ticket.nivelActual,
          nivelDestino,
          agenteDestinoId: agenteDestino.id,
          motivo: input.motivo,
        },
      });

      const updated = await tx.ticket.updateMany({
        where: { id: ticket.id, version: ticket.version },
        data: {
          nivelActual: nivelDestino,
          agenteAsignadoId: agenteDestino.id,
          estado: 'ESCALADO',
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new AppError(409, 'El ticket fue modificado concurrentemente; reintente la operacion');
      }

      const event = await tx.eventoOutbox.create({
        data: {
          tipo: 'ticket.escalado',
          agregadoId: ticket.id,
          correlationId,
          payload: {
            ticketId: ticket.id,
            escalamientoId: escalation.id,
            prioridad: ticket.prioridad,
            nivelOrigen: ticket.nivelActual,
            nivelDestino,
            agenteDestinoId: agenteDestino.id,
            motivo: input.motivo,
            venceSlaAt: new Date(ticket.venceSlaAt).toISOString(),
            occurredAt: now.toISOString(),
          },
        },
      });

      const result = await tx.ticket.findUnique({ where: { id }, include: ticketInclude });
      return { ticket: result, escalation, eventId: event.id };
    },
    { isolationLevel: 'Serializable' }
  );
}

async function close(id, input, correlationId, now = new Date()) {
  return prisma.$transaction(
    async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });
      if (!ticket) notFound('Ticket');
      if (ticket.estado !== 'RESUELTO') {
        conflict('Solo un ticket RESUELTO puede cerrarse', `Estado actual: ${ticket.estado}.`);
      }

      await tx.comentario.create({
        data: { ticketId: id, autor: 'sistema', texto: `Resolucion: ${input.resolucion}` },
      });
      const updated = await tx.ticket.update({
        where: { id },
        data: { estado: 'CERRADO', cerradoEn: now, version: { increment: 1 } },
        include: ticketInclude,
      });
      const event = await tx.eventoOutbox.create({
        data: {
          tipo: 'ticket.cerrado',
          agregadoId: id,
          correlationId,
          payload: { ticketId: id, resolucion: input.resolucion, occurredAt: now.toISOString() },
        },
      });
      return { ticket: updated, eventId: event.id };
    },
    { isolationLevel: 'Serializable' }
  );
}

async function listComments(ticketId) {
  const exists = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!exists) notFound('Ticket');
  return prisma.comentario.findMany({ where: { ticketId }, orderBy: { creadoEn: 'asc' } });
}

async function addComment(ticketId, data) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) notFound('Ticket');
  if (ticket.estado === 'CERRADO') conflict('No se puede comentar un ticket cerrado');
  return prisma.comentario.create({ data: { ticketId, ...data } });
}

async function listNotifications(ticketId) {
  const exists = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!exists) notFound('Ticket');
  return prisma.notificacion.findMany({ where: { ticketId }, orderBy: { creadoEn: 'desc' } });
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  assign,
  escalate,
  close,
  listComments,
  addComment,
  listNotifications,
  slaDueDate,
};
