FROM node:20-alpine

WORKDIR /app

COPY webhook-receiver/package.json ./
COPY webhook-receiver/package-lock.json ./
RUN npm ci --omit=dev

COPY webhook-receiver/server.js ./server.js
COPY shared/webhookSignature.js ./webhookSignature.js

EXPOSE 4000

CMD ["node", "server.js"]
