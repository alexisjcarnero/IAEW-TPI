/**
 * Seed idempotente: usuarios, agentes N1-N3, políticas de SLA por prioridad
 * y un par de tickets de ejemplo. Usa `upsert` para poder correrse varias
 * veces sin duplicar datos (por ejemplo, cada vez que se levanta el
 * contenedor `api`).
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const slaPorPrioridad = {
    CRITICA: { minutosPrimeraRespuesta: 15, minutosResolucion: 240 },
    ALTA: { minutosPrimeraRespuesta: 30, minutosResolucion: 480 },
    MEDIA: { minutosPrimeraRespuesta: 60, minutosResolucion: 1440 },
    BAJA: { minutosPrimeraRespuesta: 240, minutosResolucion: 4320 },
  };

  const slaPolicies = {};
  for (const [prioridad, valores] of Object.entries(slaPorPrioridad)) {
    slaPolicies[prioridad] = await prisma.slaPolicy.upsert({
      where: { prioridad },
      update: valores,
      create: { prioridad, ...valores },
    });
  }

  const usuario = await prisma.usuario.upsert({
    where: { email: 'solicitante.demo@iaew.local' },
    update: {},
    create: {
      nombre: 'Usuario Demo',
      email: 'solicitante.demo@iaew.local',
      rol: 'SOLICITANTE',
    },
  });

  const agenteN1 = await prisma.agente.upsert({
    where: { email: 'agente.n1@iaew.local' },
    update: {},
    create: { nombre: 'Agente Nivel 1', email: 'agente.n1@iaew.local', nivel: 'N1' },
  });

  await prisma.agente.upsert({
    where: { email: 'agente.n2@iaew.local' },
    update: {},
    create: { nombre: 'Agente Nivel 2', email: 'agente.n2@iaew.local', nivel: 'N2' },
  });

  await prisma.agente.upsert({
    where: { email: 'agente.n3@iaew.local' },
    update: {},
    create: { nombre: 'Agente Nivel 3', email: 'agente.n3@iaew.local', nivel: 'N3' },
  });

  const ticketExistente = await prisma.ticket.findFirst({
    where: { titulo: 'No puedo acceder al sistema de facturación' },
  });

  if (!ticketExistente) {
    await prisma.ticket.create({
      data: {
        titulo: 'No puedo acceder al sistema de facturación',
        descripcion: 'El usuario reporta error 500 al intentar iniciar sesión desde ayer.',
        prioridad: 'ALTA',
        estado: 'ASIGNADO',
        nivelActual: 'N1',
        solicitanteId: usuario.id,
        agenteAsignadoId: agenteN1.id,
        slaPolicyId: slaPolicies.ALTA.id,
        venceSlaAt: new Date(Date.now() + slaPolicies.ALTA.minutosResolucion * 60 * 1000),
      },
    });
  }

  console.log('Seed completado.');
}

main()
  .catch((error) => {
    console.error('Error al ejecutar el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
