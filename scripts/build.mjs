// Builds ./dist : a self-contained folder for itch.io (index.html at the root, no CDN needed).
import fs from 'fs';
import path from 'path';

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out + '/vendor/addons/loaders', { recursive: true });
fs.mkdirSync(out + '/vendor/addons/utils', { recursive: true });
fs.mkdirSync(out + '/vendor/addons/environments', { recursive: true });

fs.cpSync('js', out + '/js', { recursive: true });
fs.cpSync('assets/car.glb', out + '/assets/car.glb', { recursive: true });
fs.cpSync('assets/ground', out + '/assets/ground', { recursive: true });

const t = 'node_modules/three';
fs.copyFileSync(`${t}/build/three.module.js`, out + '/vendor/three.module.js');
for (const f of ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'environments/RoomEnvironment.js'])
  fs.copyFileSync(`${t}/examples/jsm/${f}`, `${out}/vendor/addons/${f}`);

// point the import map at the local copies instead of the CDN
let html = fs.readFileSync('index.html', 'utf8');
html = html
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/build\/three\.module\.js/, './vendor/three.module.js')
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/examples\/jsm\//, './vendor/addons/');
if (html.includes('cdn.jsdelivr.net')) throw new Error('CDN import map was not replaced');
fs.writeFileSync(out + '/index.html', html);

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`dist ready: ${(size(out) / 1e6).toFixed(2)} MB`);
