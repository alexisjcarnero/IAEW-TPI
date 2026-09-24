const express = require('express');
const pino = require('pino');
const pinoHttp = require('pino-http');

const config = require('./config');
const { correlationId } = require('./middleware/correlationId');
const { errorHandler } = require('./middleware/errorHandler');
const rabbit = require('./messaging/rabbit');

const healthRoutes = require('./routes/health');
const ticketsRoutes = require('./routes/tickets');
const agentesRoutes = require('./routes/agentes');
const usuariosRoutes = require('./routes/usuarios');
const internalRoutes = require('./routes/internal');

const logger = pino();

const app = express();

app.use(express.json());
app.use(correlationId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.correlationId,
    // Logs JSON estructurados (nivel, msg, req/res, tiempo de respuesta)
    // para observabilidad, correlacionables por x-correlation-id.
  })
);

app.use(healthRoutes);
app.use('/api/v1', ticketsRoutes);
app.use('/api/v1', agentesRoutes);
app.use('/api/v1', usuariosRoutes);
app.use(internalRoutes);

app.use((req, res) => {
  res.status(404).json({ type: 'about:blank', title: 'Recurso no encontrado', status: 404 });
});

app.use(errorHandler);

rabbit.connect(logger);

app.listen(config.port, () => {
  logger.info(`Mesa de ayuda API escuchando en :${config.port}`);
});
