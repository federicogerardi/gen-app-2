# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

COPY . .

# Install from monorepo root so workspace deps (e.g. @gen-app-2/contracts)
# are resolved locally instead of fetched from npm registry.
RUN npm ci

WORKDIR /app/apps/frontend

# Railway can provide this as a build-time variable.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Capability flags are evaluated by Vite at build-time and baked into the bundle.
ARG VITE_CAP_PROJECTS=
ARG VITE_CAP_ARTIFACTS=
ARG VITE_CAP_TOOLS_UPLOAD=
ARG VITE_CAP_MODELS=
ARG VITE_CAP_ADMIN_MODELS=
ENV VITE_CAP_PROJECTS=${VITE_CAP_PROJECTS}
ENV VITE_CAP_ARTIFACTS=${VITE_CAP_ARTIFACTS}
ENV VITE_CAP_TOOLS_UPLOAD=${VITE_CAP_TOOLS_UPLOAD}
ENV VITE_CAP_MODELS=${VITE_CAP_MODELS}
ENV VITE_CAP_ADMIN_MODELS=${VITE_CAP_ADMIN_MODELS}

RUN npm run build

EXPOSE 3000

# TASK-010b: CMD diretto a node server.mjs per evitare double-build ad ogni restart Railway.
# railway.toml startCommand è allineato a "node server.mjs".
CMD ["node", "server.mjs"]