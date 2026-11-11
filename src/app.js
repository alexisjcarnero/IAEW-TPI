const express = require('express');
const pinoHttp = require('pino-http');

const { correlationId } = require('./middleware/correlationId');
const { errorHandler } = require('./middleware/errorHandler');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');

const healthRoutes = require('./routes/health');
const ticketsRoutes = require('./routes/tickets');
const agentesRoutes = require('./routes/agentes');
const usuariosRoutes = require('./routes/usuarios');
const internalRoutes = require('./routes/internal');

function createApp(logger) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(correlationId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.correlationId,
      customProps: (req) => ({ correlationId: req.correlationId }),
      redact: ['req.headers.authorization', 'req.headers.x-api-key'],
    })
  );
  app.use(metricsMiddleware);

  app.get('/metrics', metricsHandler);
  app.use(healthRoutes);
  app.use('/api/v1', ticketsRoutes);
  app.use('/api/v1', agentesRoutes);
  app.use('/api/v1', usuariosRoutes);
  app.use(internalRoutes);

  app.use((req, res) => {
    res.status(404).type('application/problem+json').json({
      type: 'https://mesa-ayuda.local/problems/not-found',
      title: 'Recurso no encontrado',
      status: 404,
      correlationId: req.correlationId,
    });
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
