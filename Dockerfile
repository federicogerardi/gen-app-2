FROM node:22-alpine

WORKDIR /app

# Copy all package files for workspace resolution
COPY package.json package-lock.json ./

# Copy workspace package.json and lock files
COPY apps/backend/package.json apps/backend/package-lock.json ./apps/backend/
COPY apps/frontend/package.json apps/frontend/package-lock.json ./apps/frontend/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/infra-db/package.json ./packages/infra-db/

# Install all workspace dependencies
RUN npm ci --workspaces --include-workspace-root

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["npm", "run", "start"]