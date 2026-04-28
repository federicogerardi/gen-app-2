import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(scriptDir, 'dist');
const indexPath = join(distDir, 'index.html');

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

const server = createServer((request, response) => {
  const method = request.method ?? 'GET';
  const url = request.url ?? '/';
  const path = url.split('?')[0] || '/';

  if (method !== 'GET' && method !== 'HEAD') {
    response.statusCode = 405;
    response.end('Method Not Allowed');
    return;
  }

  if (path === '/health') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ ok: true, status: 'healthy' }));
    return;
  }

  const normalized = normalize(path).replace(/^\/+/, '');
  const requestedPath = join(distDir, normalized);

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    if (method === 'HEAD') {
      response.statusCode = 200;
      response.end();
      return;
    }
    sendFile(response, requestedPath);
    return;
  }

  if (!existsSync(indexPath)) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Missing dist/index.html. Ensure build step ran successfully.');
    return;
  }

  if (method === 'HEAD') {
    response.statusCode = 200;
    response.end();
    return;
  }
  sendFile(response, indexPath);
});

server.listen(port, host, () => {
  console.log(`Frontend server listening on http://${host}:${port}`);
});