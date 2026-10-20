import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

const root = resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
const port = Number(process.env.PORT || 4173);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(join(root, pathname === '/' ? 'index.html' : pathname));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Outside dist');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const ext = file.slice(file.lastIndexOf('.'));
    response.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
