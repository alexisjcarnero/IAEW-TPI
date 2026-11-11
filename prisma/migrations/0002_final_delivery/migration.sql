-- Entrega final: control de concurrencia, outbox transaccional y efecto
-- observable/idempotente del consumidor asincronico.

CREATE TYPE "EstadoNotificacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA');

ALTER TABLE "tickets" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "eventos_outbox" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "agregado_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_en" TIMESTAMP(3),
    CONSTRAINT "eventos_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "webhook_status" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado_en" TIMESTAMP(3),
    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tickets_estado_idx" ON "tickets"("estado");
CREATE INDEX "tickets_prioridad_idx" ON "tickets"("prioridad");
CREATE INDEX "tickets_vence_sla_at_idx" ON "tickets"("vence_sla_at");
CREATE INDEX "eventos_outbox_publicado_en_creado_en_idx" ON "eventos_outbox"("publicado_en", "creado_en");
CREATE UNIQUE INDEX "notificaciones_evento_id_key" ON "notificaciones"("evento_id");
CREATE INDEX "notificaciones_ticket_id_creado_en_idx" ON "notificaciones"("ticket_id", "creado_en");

ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
