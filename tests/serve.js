import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.');
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!/^\/(src|tests)\//.test(url.pathname)) throw Error();
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + sep)) throw Error();
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.glsl': 'text/plain; charset=utf-8', '.wgsl': 'text/plain; charset=utf-8' }[extname(path)] || 'text/plain' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(5175, '127.0.0.1', () => console.log('Checks: http://localhost:5175/tests/browser.html'));
