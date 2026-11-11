const test = require('node:test');
const assert = require('node:assert/strict');

const schemas = require('../../src/validation/schemas');

const UUID = '11111111-1111-4111-8111-111111111111';

test('ticketCreate aplica prioridad MEDIA por defecto y normaliza strings', () => {
  const parsed = schemas.ticketCreate.parse({
    titulo: '  Error de acceso  ',
    descripcion: 'No puedo iniciar sesion',
    solicitanteId: UUID,
  });
  assert.equal(parsed.titulo, 'Error de acceso');
  assert.equal(parsed.prioridad, 'MEDIA');
});

test('ticketCreate rechaza UUID invalido y campos desconocidos', () => {
  assert.equal(
    schemas.ticketCreate.safeParse({ titulo: 'x', descripcion: 'y', solicitanteId: '123' }).success,
    false
  );
  assert.equal(
    schemas.ticketCreate.safeParse({
      titulo: 'x',
      descripcion: 'y',
      solicitanteId: UUID,
      estado: 'CERRADO',
    }).success,
    false
  );
});

test('los PATCH vacios se rechazan', () => {
  assert.equal(schemas.ticketUpdate.safeParse({}).success, false);
  assert.equal(schemas.agenteUpdate.safeParse({}).success, false);
  assert.equal(schemas.usuarioUpdate.safeParse({}).success, false);
});

test('escalamiento exige motivo y admite agente UUID opcional', () => {
  assert.equal(schemas.escalamientoCreate.safeParse({ motivo: '' }).success, false);
  assert.equal(schemas.escalamientoCreate.safeParse({ motivo: 'SLA en riesgo', agenteDestinoId: UUID }).success, true);
});
