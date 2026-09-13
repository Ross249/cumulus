import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const built = process.argv.includes('--dist');
const root = resolve(project, built ? 'dist' : '.');
const publicRoot = built ? root : resolve(root, 'website');
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.glsl': 'text/plain; charset=utf-8', '.wgsl': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const base = pathname.startsWith('/src/') ? root : publicRoot;
    const path = resolve(base, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(base + sep) || !(await stat(path)).isFile()) throw new Error('Not found');
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Cumulus → http://localhost:${port}`));
