# ADR 0005 — Integración adicional: Webhook firmado (HMAC-SHA256)

- **Estado:** Aceptada
- **Fecha:** 2026-09-24

## Contexto

La consigna pide elegir una integración adicional: webhook con callback firmado/secreto, gRPC con proto/stub, o WebSocket con stream/suscripción. Para Mesa de ayuda, el enunciado del dominio sugiere "Webhook a canal externo, WebSocket de tablero o gRPC a usuarios".

## Decisión

Implementar un **webhook saliente firmado** (`src/messaging/webhookNotifier.js`): cuando un ticket se escala o se cierra, la API hace `POST` al canal externo con el body JSON y un header `X-Signature-256: sha256=<hmac>`, calculado con un secreto compartido (`WEBHOOK_SECRET`). El receptor (simulado por el servicio `webhook-receiver`) recalcula el HMAC sobre el body crudo y lo compara con comparación de tiempo constante (`crypto.timingSafeEqual`) antes de aceptar el evento.

## Alternativas consideradas

- **WebSocket de tablero**: más vistoso para una demo en vivo, pero agrega un componente de estado (conexiones activas) más complejo de probar automáticamente con Postman/Newman.
- **gRPC a usuarios**: requiere definir `.proto`, generar stubs y correr HTTP/2, mayor costo de configuración para el mismo objetivo funcional en esta entrega.

El webhook firmado es el más simple de demostrar con `curl`/Postman y de verificar en un test automatizado (la firma es determinística).

## Consecuencias

- Se agrega el servicio `webhook-receiver` al `docker-compose.yml` como placeholder del canal externo real.
- El README debe documentar cómo se firma el payload y cómo probarlo manualmente.
- Pendiente (Entrega 2): invocar `sendWebhook()` desde el flujo real de escalamiento/cierre de tickets, hoy stub.
