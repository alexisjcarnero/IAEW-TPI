const { AppError } = require('../http/AppError');

const NEXT_LEVEL = { N1: 'N2', N2: 'N3' };
const ALLOWED_STATES = new Set(['ASIGNADO', 'EN_PROGRESO', 'ESCALADO']);

function nextLevel(level) {
  return NEXT_LEVEL[level] || null;
}

function validateEscalationEligibility(ticket, now = new Date()) {
  if (!ALLOWED_STATES.has(ticket.estado)) {
    throw new AppError(409, 'Escalamiento no permitido para el estado actual', {
      detail: `El ticket esta en estado ${ticket.estado}.`,
    });
  }
  if (!ticket.agenteAsignado || !ticket.agenteAsignado.activo) {
    throw new AppError(409, 'El ticket requiere un responsable activo antes de escalarse');
  }
  if (ticket.agenteAsignado.nivel !== ticket.nivelActual) {
    throw new AppError(409, 'El nivel del responsable no coincide con el nivel actual del ticket');
  }

  const nivelDestino = nextLevel(ticket.nivelActual);
  if (!nivelDestino) {
    throw new AppError(409, 'El ticket ya se encuentra en el nivel maximo N3');
  }

  const policy = ticket.slaPolicy;
  if (!policy || policy.minutosPrimeraRespuesta <= 0 || policy.minutosResolucion <= 0) {
    throw new AppError(409, 'SLA mal configurado para la prioridad del ticket');
  }
  if (!ticket.venceSlaAt) {
    throw new AppError(409, 'El ticket no tiene vencimiento de SLA calculado');
  }

  const venceSlaAt = new Date(ticket.venceSlaAt);
  const atRiskAt = new Date(venceSlaAt.getTime() - policy.minutosPrimeraRespuesta * 60_000);
  const priorityAllowsImmediateEscalation = ['ALTA', 'CRITICA'].includes(ticket.prioridad);
  if (!priorityAllowsImmediateEscalation && now < atRiskAt) {
    throw new AppError(409, 'El escalamiento aun no esta habilitado por prioridad o riesgo de SLA', {
      detail: `Para prioridad ${ticket.prioridad}, se habilita a partir de ${atRiskAt.toISOString()}.`,
    });
  }

  return { nivelDestino, atRiskAt, venceSlaAt };
}

module.exports = { nextLevel, validateEscalationEligibility };
