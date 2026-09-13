import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL('website/', root), dist, { recursive: true });
await cp(new URL('src/', root), new URL('src/', dist), { recursive: true });
console.log('Built dist/ — plain HTML, CSS, JavaScript. No dependencies.');
