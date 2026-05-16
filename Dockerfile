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

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["npm", "run", "start"]