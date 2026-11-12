FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache openssl

COPY worker/package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY worker/index.js ./index.js
COPY shared/webhookSignature.js ./webhookSignature.js
COPY shared/rabbitTopology.js ./rabbitTopology.js

EXPOSE 9100
CMD ["node", "index.js"]
