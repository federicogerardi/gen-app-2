FROM node:22-alpine

WORKDIR /app

# Copy all package files for workspace resolution
COPY package.json package-lock.json ./
COPY apps/*/package.json apps/
COPY packages/*/package.json packages/

# Install all workspace dependencies
RUN npm ci --workspaces --include-workspace-root

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["npm", "run", "start"]