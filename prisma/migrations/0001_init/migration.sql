-- Migración inicial: esquema de Mesa de ayuda (usuarios, agentes, SLA, tickets, comentarios, escalamientos)

-- Enums
CREATE TYPE "RolUsuario" AS ENUM ('SOLICITANTE', 'SUPERVISOR');
CREATE TYPE "NivelAgente" AS ENUM ('N1', 'N2', 'N3');
CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');
CREATE TYPE "EstadoTicket" AS ENUM ('ABIERTO', 'ASIGNADO', 'EN_PROGRESO', 'ESCALADO', 'RESUELTO', 'CERRADO');

-- Tabla: usuarios
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'SOLICITANTE',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- Tabla: agentes
CREATE TABLE "agentes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nivel" "NivelAgente" NOT NULL DEFAULT 'N1',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agentes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agentes_email_key" ON "agentes"("email");

-- Tabla: sla_policies
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "prioridad" "Prioridad" NOT NULL,
    "minutos_primera_respuesta" INTEGER NOT NULL,
    "minutos_resolucion" INTEGER NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sla_policies_prioridad_key" ON "sla_policies"("prioridad");

-- Tabla: tickets
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoTicket" NOT NULL DEFAULT 'ABIERTO',
    "nivel_actual" "NivelAgente" NOT NULL DEFAULT 'N1',
    "solicitante_id" TEXT NOT NULL,
    "agente_asignado_id" TEXT,
    "sla_policy_id" TEXT NOT NULL,
    "vence_sla_at" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "cerrado_en" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_solicitante_id_fkey"
    FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_agente_asignado_id_fkey"
    FOREIGN KEY ("agente_asignado_id") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sla_policy_id_fkey"
    FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tabla: comentarios
CREATE TABLE "comentarios" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tabla: escalamientos
CREATE TABLE "escalamientos" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "nivel_origen" "NivelAgente" NOT NULL,
    "nivel_destino" "NivelAgente" NOT NULL,
    "agente_destino_id" TEXT,
    "motivo" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalamientos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "escalamientos" ADD CONSTRAINT "escalamientos_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalamientos" ADD CONSTRAINT "escalamientos_agente_destino_id_fkey"
    FOREIGN KEY ("agente_destino_id") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
