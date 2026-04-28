# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Railway can provide this as a build-time variable.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist ./

# SPA fallback + health endpoint. PORT is injected by Railway at runtime.
RUN cat <<'EOF' > /etc/nginx/templates/default.conf.template
server {
  listen ${PORT};
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location = /health {
    add_header Content-Type text/plain;
    return 200 'ok';
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]