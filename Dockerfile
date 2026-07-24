FROM node:22-alpine

WORKDIR /app

# Copy root package and lock files only
COPY package.json package-lock.json ./

# Copy all workspace package.json files (lock files may not exist for all)
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/frontend/package-lock.json ./apps/frontend/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/infra-db/package.json ./packages/infra-db/

# Install all workspace dependencies (uses root lock file + workspace package.json)
RUN npm ci --workspaces --include-workspace-root

# Copy remaining source code
COPY . .

# Build frontend for production
RUN npm --workspace apps/frontend run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# SERVICE_ROLE determines which process to run:
#   server (default) — HTTP server on port 3000
#   worker — BullMQ worker (no port exposed)
ARG SERVICE_ROLE=server
ENV SERVICE_ROLE=${SERVICE_ROLE}

EXPOSE 3000

# Conditional entry point based on SERVICE_ROLE
CMD if [ "$SERVICE_ROLE" = "worker" ]; then \
      npm --workspace apps/backend run start:worker; \
    else \
      npm run start; \
    fi
