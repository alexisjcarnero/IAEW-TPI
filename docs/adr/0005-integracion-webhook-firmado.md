# ADR 0005 — Integración adicional por webhook HMAC-SHA256

- **Estado:** Aceptada e implementada
- **Fecha:** 2026-09-24; actualizada 2026-11-10

## Contexto

El dominio sugiere notificar un canal externo al escalar/cerrar. HTTP por sí solo no permite al receptor distinguir un emisor legítimo de una llamada falsificada.

## Decisión

El worker serializa el evento y calcula `HMAC-SHA256(WEBHOOK_SECRET, rawBody)`. Envía `X-Signature-256: sha256=<hex>`, `X-Event-Id` y `X-Correlation-Id`. El receptor calcula el HMAC sobre el mismo body crudo y compara bytes con `crypto.timingSafeEqual`.

La firma cubre todo el evento, incluidos identificador, tipo, timestamp, correlation ID y datos. Una alteración de un solo byte invalida la petición.

## Alternativas consideradas

- WebSocket: útil para un tablero vivo, pero requiere administrar conexiones y no cubre tan directamente la notificación servicio-a-servicio.
- gRPC: contrato fuerte, aunque agrega HTTP/2, proto y stubs sin beneficio claro en este caso.
- API key simple en header: autentica por conocimiento del secreto pero no garantiza integridad del cuerpo.

## Consecuencias

- El receptor debe conservar el body crudo; parsear y reserializar puede cambiar bytes.
- El secreto nunca se envía ni se versiona.
- HTTPS sigue siendo necesario en producción: HMAC aporta autenticidad/integridad, no confidencialidad.
- Como mejora futura puede agregarse ventana temporal y nonce para prevenir replay fuera del control idempotente actual.
