FROM node:24.10-alpine AS builder

WORKDIR /app

COPY . .

RUN npm i
RUN npm run build

FROM node:24.10-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "dist/main.js"]
