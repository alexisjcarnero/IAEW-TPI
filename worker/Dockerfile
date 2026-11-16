FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache openssl

COPY worker/package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY worker/index.js ./worker/index.js
COPY worker/retry.js ./worker/retry.js
COPY shared/webhookSignature.js ./shared/webhookSignature.js
COPY shared/rabbitTopology.js ./shared/rabbitTopology.js

EXPOSE 9100
CMD ["node", "worker/index.js"]
