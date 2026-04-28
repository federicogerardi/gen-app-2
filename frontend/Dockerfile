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
RUN npm install -g serve@14.2.4

EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]