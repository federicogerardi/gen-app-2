# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Railway can provide this as a build-time variable.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

EXPOSE 3000

# TASK-010b: CMD diretto a node server.mjs per evitare double-build ad ogni restart Railway.
# railway.toml startCommand è allineato a "node server.mjs".
CMD ["node", "server.mjs"]