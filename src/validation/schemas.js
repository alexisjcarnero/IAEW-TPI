const { z } = require('zod');

const uuid = z.string().uuid('Debe ser un UUID valido');
const nonEmpty = (field, max) => z.string().trim().min(1, `${field} es obligatorio`).max(max);

const idParams = z.object({ id: uuid }).strict();

const ticketQuery = z
  .object({
    estado: z.enum(['ABIERTO', 'ASIGNADO', 'EN_PROGRESO', 'ESCALADO', 'RESUELTO', 'CERRADO']).optional(),
    prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

const ticketCreate = z
  .object({
    titulo: nonEmpty('titulo', 160),
    descripcion: nonEmpty('descripcion', 4000),
    prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'),
    solicitanteId: uuid,
  })
  .strict();

const ticketUpdate = z
  .object({
    titulo: nonEmpty('titulo', 160).optional(),
    descripcion: nonEmpty('descripcion', 4000).optional(),
    prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
    estado: z.enum(['EN_PROGRESO', 'RESUELTO']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');

const asignacionCreate = z.object({ agenteId: uuid }).strict();
const escalamientoCreate = z
  .object({
    motivo: nonEmpty('motivo', 500),
    agenteDestinoId: uuid.optional(),
  })
  .strict();
const cierreCreate = z.object({ resolucion: nonEmpty('resolucion', 2000) }).strict();
const comentarioCreate = z
  .object({ autor: nonEmpty('autor', 120), texto: nonEmpty('texto', 2000) })
  .strict();

const agenteQuery = z
  .object({
    nivel: z.enum(['N1', 'N2', 'N3']).optional(),
    activo: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  })
  .strict();
const agenteCreate = z
  .object({
    nombre: nonEmpty('nombre', 120),
    email: z.string().trim().email().max(254),
    nivel: z.enum(['N1', 'N2', 'N3']),
    activo: z.boolean().default(true),
  })
  .strict();
const agenteUpdate = z
  .object({
    nombre: nonEmpty('nombre', 120).optional(),
    email: z.string().trim().email().max(254).optional(),
    nivel: z.enum(['N1', 'N2', 'N3']).optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');

const usuarioCreate = z
  .object({
    nombre: nonEmpty('nombre', 120),
    email: z.string().trim().email().max(254),
    rol: z.enum(['SOLICITANTE', 'SUPERVISOR']).default('SOLICITANTE'),
  })
  .strict();
const usuarioUpdate = z
  .object({
    nombre: nonEmpty('nombre', 120).optional(),
    email: z.string().trim().email().max(254).optional(),
    rol: z.enum(['SOLICITANTE', 'SUPERVISOR']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');

module.exports = {
  idParams,
  ticketQuery,
  ticketCreate,
  ticketUpdate,
  asignacionCreate,
  escalamientoCreate,
  cierreCreate,
  comentarioCreate,
  agenteQuery,
  agenteCreate,
  agenteUpdate,
  usuarioCreate,
  usuarioUpdate,
};
