import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// TASK-009: BACKEND_INTERNAL_URL — env server-side, non esposta nel bundle Vite.
// Default locale: http://localhost:3000
// Produzione Railway: http://<backend-service>.railway.internal:<port>
// Fail-fast in produzione se non impostata.
// Normalizzazione: aggiunge http:// se manca il protocollo.
// ---------------------------------------------------------------------------
let BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000';

if (process.env.NODE_ENV === 'production' && !process.env.BACKEND_INTERNAL_URL) {
  console.error('[server] FATAL: BACKEND_INTERNAL_URL is required in production');
  process.exit(1);
}

// Normalizza URL: se non inizia con http:// o https://, aggiungi http://
if (!BACKEND_INTERNAL_URL.startsWith('http://') && !BACKEND_INTERNAL_URL.startsWith('https://')) {
  BACKEND_INTERNAL_URL = `http://${BACKEND_INTERNAL_URL}`;
  console.log(`[server] Normalized BACKEND_INTERNAL_URL to: ${BACKEND_INTERNAL_URL}`);
}

const host = '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(scriptDir, 'dist');
const indexPath = join(distDir, 'index.html');

// ---------------------------------------------------------------------------
// TASK-005b: Proxy implementato con node:http / node:https built-in.
// Scelta rispetto a undici: node:http è disponibile senza dipendenze aggiuntive,
// supporta pipe di stream (SSE), timeout configurabili e header forwarding completo.
// undici sarebbe alternativa valida per Node 18+ ma non aggiunge valore qui.
// ---------------------------------------------------------------------------

// Header hop-by-hop HTTP/1.1: non devono essere inoltrati al browser.
// Passarli causa "Error: Invalid header value" a runtime Node.js.
const HOP_BY_HOP = new Set([
  'transfer-encoding',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'upgrade',
]);

// TASK-004: prefissi proxy — matching con url.startsWith(prefix), qualunque metodo HTTP.
// Ordine di valutazione: /health → proxy → static → SPA fallback.
const PROXY_PREFIXES = ['/auth', '/generation', '/api', '/admin/users'];

function isProxyPath(urlPath) {
  const normalized = urlPath.endsWith('/') ? urlPath : urlPath;
  return PROXY_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + '/') || normalized.startsWith(prefix + '?'),
  );
}

function isAdminUsersPath(urlPath) {
  return urlPath === '/admin/users' || urlPath.startsWith('/admin/users/');
}

function isDocumentNavigation(request, method) {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }

  const secFetchDest = request.headers['sec-fetch-dest'];
  const accept = request.headers.accept ?? '';

  if (typeof secFetchDest === 'string' && secFetchDest.toLowerCase() === 'document') {
    return true;
  }

  return typeof accept === 'string' && accept.includes('text/html');
}

// TASK-020: logger sintetico — non espone header, cookie o body.
function logReq(type, method, path) {
  console.log(`[req] ${type} ${method} ${path}`);
}

// TASK-006/007/008: proxy request verso backend interno Railway.
function handleProxy(request, response, backendUrl) {
  const t0 = Date.now();
  const logPath = (request.url ?? '/').split('?')[0];
  logReq('proxy', request.method ?? 'GET', logPath);

  const targetUrl = new URL(backendUrl);
  const isHttps = targetUrl.protocol === 'https:';
  const reqFn = isHttps ? httpsRequest : httpRequest;

  // Forward headers request: escludere host (riscritto), aggiungere x-forwarded-for
  const forwardHeaders = { ...request.headers };
  delete forwardHeaders['host'];
  forwardHeaders['x-forwarded-for'] =
    request.headers['x-forwarded-for']
      ? `${request.headers['x-forwarded-for']}, ${request.socket.remoteAddress}`
      : (request.socket.remoteAddress ?? '');
  forwardHeaders['x-real-ip'] = forwardHeaders['x-real-ip'] ?? request.socket.remoteAddress ?? '';

  const upstreamReq = reqFn(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: request.url,
      method: request.method,
      headers: forwardHeaders,
    },
    (upstreamRes) => {
      // TASK-006: forward integrale header risposta, esclusi hop-by-hop
      const isSSE = (upstreamRes.headers['content-type'] ?? '').includes('text/event-stream');

      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (!HOP_BY_HOP.has(key.toLowerCase())) {
          response.setHeader(key, value);
        }
      }

      response.statusCode = upstreamRes.statusCode ?? 502;
      const elapsed = Date.now() - t0;
      console.log(`[proxy] ${request.method ?? 'GET'} ${logPath} → ${response.statusCode} (${elapsed}ms)`);

      if (isSSE) {
        // TASK-007: SSE — flush immediato, no Nagle, pipe senza buffering
        response.socket?.setNoDelay(true);
        response.flushHeaders();
        upstreamRes.pipe(response, { end: true });
      } else {
        upstreamRes.pipe(response, { end: true });
      }
    },
  );

  // TASK-007: chiudi upstream solo su abort reale del client.
  // Usare 'close' su request tronca anche richieste sane e causa ECONNRESET.
  request.on('aborted', () => {
    upstreamReq.destroy();
  });

  // Se il client chiude la response prima del completamento, interrompi upstream.
  response.on('close', () => {
    if (!response.writableEnded) {
      upstreamReq.destroy();
    }
  });

  // TASK-008: backend non raggiungibile → 502 con diagnostica minimale
  upstreamReq.on('error', (err) => {
    const elapsed = Date.now() - t0;
    console.error(`[proxy] error (${elapsed}ms): ${err.code} ${err.message} → ${backendUrl}${request.url}`);
    if (!response.headersSent) {
      response.statusCode = 502;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Bad Gateway', code: err.code }));
    } else {
      response.destroy();
    }
  });

  // Forward body request (POST, PUT, PATCH, ecc.)
  request.pipe(upstreamReq, { end: true });
}

const MIME_BY_EXT = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const sendFile = (response, filePath) => {
  const extension = extname(filePath).toLowerCase();
  const contentType = MIME_BY_EXT[extension] ?? 'application/octet-stream';
  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  createReadStream(filePath).pipe(response);
};

// ---------------------------------------------------------------------------
// Request handler — ordine di valutazione (TASK-004):
//   (1) /health           → risposta locale
//   (2) prefissi proxy    → forward al backend, qualunque metodo HTTP (TASK-005)
//   (3) asset statici     → dist/
//   (4) SPA fallback      → dist/index.html
//
// TASK-005: guardia 405 rimossa dalla posizione globale; si applica solo a (4)/(5).
// ---------------------------------------------------------------------------
const server = createServer((request, response) => {
  const method = request.method ?? 'GET';
  const url = request.url ?? '/';
  const path = url.split('?')[0] || '/';

  // (1) Healthcheck locale
  if (path === '/health') {
    logReq('health', method, path);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ ok: true, status: 'healthy' }));
    return;
  }

  // (2) Proxy verso backend interno — qualunque metodo HTTP
  if (isProxyPath(path) && !(isAdminUsersPath(path) && isDocumentNavigation(request, method))) {
    handleProxy(request, response, BACKEND_INTERNAL_URL);
    return;
  }

  // (3) Asset statici — solo GET/HEAD
  if (method !== 'GET' && method !== 'HEAD') {
    logReq('405', method, path);
    response.statusCode = 405;
    response.end('Method Not Allowed');
    return;
  }

  const normalized = normalize(path).replace(/^\/+/, '');
  const requestedPath = join(distDir, normalized);

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    logReq('static', method, path);
    if (method === 'HEAD') {
      response.statusCode = 200;
      response.end();
      return;
    }
    sendFile(response, requestedPath);
    return;
  }

  // (4) SPA fallback
  if (!existsSync(indexPath)) {
    console.error('[server] Missing dist/index.html — build step may have failed');
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Missing dist/index.html. Ensure build step ran successfully.');
    return;
  }

  logReq('spa', method, path);

  if (method === 'HEAD') {
    response.statusCode = 200;
    response.end();
    return;
  }
  sendFile(response, indexPath);
});

server.listen(port, host, () => {
  console.log(`[server] Frontend proxy listening on http://${host}:${port}`);
  console.log(`[server] Backend internal URL: ${BACKEND_INTERNAL_URL}`);
});
