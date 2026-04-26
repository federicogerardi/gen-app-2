# Deployment Architecture Guide

**Data**: 2026-04-25  
**Revisione**: 1.0  
**Scope**: Opzioni di deployment frontend/backend, compatibilità platform, configurazione production

---

## Architettura Attuale: Riepilogo

| Layer | Tecnologia | Requisiti |
|-------|-----------|----------|
| **Frontend** | React 19 + Vite (SPA) | ✅ Statico, compilabile |
| **Backend** | Node.js + Express | ❌ Server persistente |
| **Auth** | Cookie-based sessions (HTTP-only) | ❌ Stateful |
| **Database** | PostgreSQL (pool connections) | ❌ Persistente |
| **Cache** | Redis (Upstash) | ❌ Sessioni + idempotency persistenti |
| **Streaming** | SSE (`/generation/stream`) | ❌ Keep-alive long-polling |

---

## Compatibilità Platform

### ❌ Netlify (Non compatibile come full-stack)

**Limitazioni critiche:**
- Netlify = frontend statico + serverless functions con timeout 26 sec
- SSE streaming richiede connessioni long-lived (open indefinitamente)
- Sessioni auth basate su cookie: serverless perde stato tra invocazioni
- Pool PostgreSQL + Redis connections non sopravvivono tra funzioni

**Caso d'uso Netlify:** Solo frontend statico (vedi "Opzione 1" sotto)

### ✅ Railway.app (Consigliato)

- ✅ Native Node.js server
- ✅ Connessioni persistent (database + redis)
- ✅ SSE streaming supportato
- ✅ Zero-downtime deploys
- ✅ PostgreSQL + Redis preconfigurati via plugins
- 💰 Free tier: $5/mese, scalabile

### ✅ Render.com

- ✅ Node.js native
- ✅ Connessioni persistent
- ✅ SSE working
- ✅ PG + Redis plugin
- 💰 Free tier: auto-sleep dopo inattività (per demo OK)

### ✅ Fly.io

- ✅ Docker-native, full control
- ✅ Persistent connections
- ✅ SSE + streaming
- ✅ Global regions con failover
- 💰 Free: 3 shared-cpu-1x VMs per app

### ✅ Vercel (Alternative full-stack)

- ✅ Support Node.js Server Runtime (beta / pro)
- ⚠️ Setup più complesso che Railway
- 💰 Più caro per backend continuo

---

## Strategie di Deployment

### **Opzione 1: Netlify Frontend + Railway Backend** ⭐ Consigliato

**Topologia:**
```
Frontend (Netlify SPA) → Backend (Railway Node.js) ↔ PostgreSQL + Redis
```

**Setup Netlify:**

```toml
# netlify.toml
[build]
  command = "npm --prefix frontend run build"
  publish = "frontend/dist"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend.railway.app/api/:splat"
  status = 200

[[redirects]]
  from = "/generation/*"
  to = "https://your-backend.railway.app/generation/:splat"
  status = 200

[[redirects]]
  from = "/auth/*"
  to = "https://your-backend.railway.app/auth/:splat"
  status = 200

[[redirects]]
  from = "/admin/users/*"
  to = "https://your-backend.railway.app/admin/users/:splat"
  status = 200
```

**Env vars Netlify:**
```bash
BACKEND_URL=https://your-backend.railway.app
FRONTEND_ORIGIN=https://your-app.netlify.app
```

**Deploy backend su Railway:**

```bash
# 1. Installa Railway CLI
railway login

# 2. Crea nuovo progetto
railway init

# 3. Aggiungi service (Node.js auto-detect)
railway add --plugin postgres  # Auto crea PG + db env var
railway add --plugin redis      # Opzionale: Railway Redis (o usa Upstash)

# 4. Configura env vars
railway env UPSTASH_REDIS_URL="redis://..."  # Dalla dashboard Upstash
railway env CORS_ALLOWED_ORIGINS="https://your-app.netlify.app"
railway env FRONTEND_ORIGIN="https://your-app.netlify.app"
railway env NODE_ENV="production"
railway env AUTH_COOKIE_SECURE="true"
railway env AUTH_COOKIE_SAMESITE="lax"

# 5. Deploy
railway up
```

**Problemi comuni & fix:**

| Problema | Causa | Soluzione |
|----------|-------|----------|
| API 403 CORS | Header mismatch | Assicurati CORS_ALLOWED_ORIGINS includa lo schema `https://` |
| Auth fallisce cross-domain | SameSite cookie | Railway auto-detection OK; verifica AUTH_COOKIE_SECURE=true |
| SSE taglia dopo 15s | Nginx/proxy timeout | Railway supporta, verifica backend non termina |
| Frontend dist vuoto | Build fallisce | `npm --prefix frontend run build` localmente prima di deploy |

---

### **Opzione 2: Docker self-hosted (Massimo controllo)**

**Dockerfile root:**

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Build frontend
COPY frontend ./frontend
RUN npm --prefix frontend ci && npm --prefix frontend run build

# Backend setup
COPY . .
RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "start:server"]
```

**Deploy con:**
- Railway (upload docker)
- Fly.io (`flyctl deploy`)
- Digital Ocean App Platform
- AWS ECS / AppRunner
- Self-hosted Docker Compose

---

### **Opzione 3: Vercel Full-Stack** (Alternative)

⚠️ Opzione più costosa, ma se vuoi SPA + backend unificato:

```bash
npm install -D @vercel/node
```

Richiede restructuring per `api/` folder + separato `frontend/pages/`.

---

## Pre-Deployment Checklist

```bash
# 1. Build frontend
npm --prefix frontend run build
→ Verify output: frontend/dist/ (index.html + assets)

# 2. Typecheck
npm run typecheck
npm --prefix frontend run typecheck

# 3. Test backend
npm run backend:go
→ Runs: migrations + seeds + tests + smoke tests

# 4. Test SSE streaming locally
curl -v \
  -H "Authorization: Bearer test-token" \
  http://localhost:3000/generation/stream
→ Expect: Connection upgrade + SSE frame stream

# 5. Verify .env locals
cat .env.local
→ Must have: DATABASE_URL, UPSTASH_REDIS_URL
→ Correct: POSTGRES schema, Redis URL format

# 6. Dry-run migrations in DB vuoto
npm run db:migrate:minimal
→ Verify: 3 migration files execute OK

# 7. Check compiled frontend bundle size
ls -lh frontend/dist/
→ index.html: < 50KB, assets: < 500KB typical
```

---

## Cookie & CORS Production

### Cookie SameSite Scenarios

| Scenario | SameSite | Secure | HTTPOnly | Example |
|----------|----------|--------|----------|---------|
| Same-domain (api.same.com) | "Lax" | true (prod) | true | ✅ OK |
| Cross-domain (cdn.other.com) | "None" | **must be true** | true | ⚠️ Requires HTTPS + Secure |
| localhost dev (different ports) | "Lax" | false (dev) | true | ✅ OK for dev |

**Config backend per production:**

```typescript
// Da src/server.ts:
const cookieSecure = parseBooleanEnv(
  process.env.AUTH_COOKIE_SECURE, 
  process.env.NODE_ENV === 'production'  // Auto true in prod
);

const cookieSameSite = (
  process.env.AUTH_COOKIE_SAMESITE ?? 'lax'
).toLowerCase() as 'lax' | 'strict' | 'none';
```

**Railway env setup:**
```bash
railway env AUTH_COOKIE_SECURE="true"
railway env AUTH_COOKIE_SAMESITE="lax"
```

---

## Monitoraggio Post-Deploy

### Health Check Endpoint

Aggiungere endpoint status (traccia in src/server.ts):

```typescript
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});
```

**Configure Railway health check:**
- Endpoint: `GET /health`
- Expected: 200 OK
- Interval: 30s
- Timeout: 5s

### Logs & Debugging

**Railway logs:**
```bash
railway logs
railway logs --follow
```

**Netlify logs:**
```bash
netlify logs:functions
netlify logs:deploy
```

---

## Raccomandazione Finale

**Per questo progetto: Usa Opzione 1 (Netlify Frontend + Railway Backend)**

**Motivi:**
1. ✅ Architettura semplice: SPA + Node.js server separati
2. ✅ Zero migration code needed
3. ✅ SSE streaming fully supported
4. ✅ Free tier viable (Netlify $0-$19/mo, Railway $5+)
5. ✅ Scaling predictable: budget control per tier
6. ✅ Debugging facile: separazione cleanly separated concerns

**Timeline setup:**
- Railway backend: 15 min
- Netlify frontend: 5 min
- Test integration: 10 min
- **Total: ~30 min da zero a production**