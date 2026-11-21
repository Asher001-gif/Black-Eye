import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeState, step, CAR } from './physics.js';
import { buildCenterline, buildRoadGeometry, distToCenter, ROAD } from './track.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHAPE = params.get('shape') === 'circle' ? 'circle' : 'square';
$('btnTrack').textContent = 'Track: ' + (SHAPE === 'circle' ? 'Circle' : 'Square');
$('btnTrack').onclick = () => { params.set('shape', SHAPE === 'circle' ? 'square' : 'circle'); location.search = params.toString(); };
$('btnFull').onclick = async () => {
  try { if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); try { await screen.orientation.lock('landscape'); } catch {} } else document.exitFullscreen(); } catch {}
};

// ---------- renderer / scene ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0xbfe3ff), TOP = new THREE.Color(0x2f86e6);
scene.background = HORIZON;
scene.fog = new THREE.Fog(HORIZON, 220, 1100);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // so metallic paint doesn't render black

const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 3000);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xdff0ff, 0x4a7a3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.set(-120, 200, 80); scene.add(sun);

// sky dome (blue gradient)
const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: TOP }, bottom: { value: HORIZON } },
  vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, pow(clamp(h,0.0,1.0),0.55)),1.0); }',
}));
scene.add(sky);

// ground (plain green, subtle checks so you can feel the speed)
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}
const grass = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#4f9d3a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#58a842'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
}, true);
grass.repeat.set(300, 300);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ map: grass }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

// ---------- road ----------
const center = buildCenterline(SHAPE);
const roadTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#3b3e44'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { const v = 50 + Math.random() * 25; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = '#e8e8e8'; g.fillRect(14, 0, 9, h); g.fillRect(w - 23, 0, 9, h);          // edge lines
  g.fillStyle = '#f2c230'; g.fillRect(w / 2 - 4, 0, 8, h / 2);                            // dashed centre line
}, false);
roadTex.wrapS = THREE.ClampToEdgeWrapping; roadTex.wrapT = THREE.RepeatWrapping;
const road = new THREE.Mesh(buildRoadGeometry(center), new THREE.MeshStandardMaterial({
  map: roadTex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
scene.add(road);

// ---------- car ----------
const carRoot = new THREE.Group(); scene.add(carRoot);
const tilt = new THREE.Group(); carRoot.add(tilt);
const wheels = {};
const shadowTex = canvasTex(128, 256, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, h / 2);
  r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
}, false);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; carRoot.add(shadow);

const loadEl = $('loading'), bar = document.querySelector('#bar i');
new GLTFLoader().load('assets/car.glb', (gltf) => {
  gltf.scene.traverse((o) => { if (o.material) { o.material.envMapIntensity = 1.0; if (o.material.transparent) o.material.depthWrite = false; } });
  for (const k of ['FL', 'FR', 'RL', 'RR']) { const w = gltf.scene.getObjectByName('Wheel_' + k); if (w) { w.rotation.order = 'YXZ'; wheels[k] = w; } }
  tilt.add(gltf.scene); applyPaint();
  loadEl.classList.add('hide'); started = true;
}, (e) => { if (e.total) bar.style.width = (100 * e.loaded / e.total) + '%'; },
(err) => { $('loadmsg').innerHTML = 'Could not load assets/car.glb.<br><small>Serve the folder over http (e.g. <code>python3 -m http.server</code>) — opening index.html directly from a file won\'t work.</small>'; console.error(err); });
let started = false;

// paint colour button (the supplied car texture is a very dark paint, so offer a few colours)
const PAINTS = [['Red', 0xc8101e], ['Yellow', 0xf2b705], ['Blue', 0x1457d6], ['White', 0xe9eaee], ['Original', 0x0f1a12]];
let paintIdx = Math.max(0, PAINTS.findIndex((p) => p[0].toLowerCase() === (params.get('paint') || 'red').toLowerCase()));
function applyPaint() {
  const [name, hex] = PAINTS[paintIdx]; $('btnPaint').textContent = 'Paint: ' + name;
  const n = tilt.getObjectByName('Body_CarpaintMain');
  if (n) n.traverse((o) => { if (o.material) o.material.color.setHex(hex).convertSRGBToLinear(); });
}
$('btnPaint').onclick = () => { paintIdx = (paintIdx + 1) % PAINTS.length; applyPaint(); };

// ---------- state ----------
const S = makeState();
function resetCar() {
  S.x = center[0].x; S.z = center[0].y; S.yaw = -Math.PI / 2; S.vx = S.vz = 0; S.steer = 0; S.speed = 0;
  camYaw = S.yaw;
  placeCar(); placeCamera(1);
}
$('btnReset').onclick = resetCar;

// ---------- input ----------
const input = { steer: 0, gas: 0, brake: 0 };
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR') resetCar(); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// joystick (steering)
const stick = $('stick'), knob = $('knob'); let stickId = null, stickX = 0;
const STICK_R = 55;
function stickMove(e) {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy); if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  let v = dx / STICK_R; const dz = 0.08; v = Math.abs(v) < dz ? 0 : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz);
  stickX = Math.sign(v) * Math.pow(Math.abs(v), 1.25);
}
stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(stickId); stickMove(e); e.preventDefault(); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId === stickId) { stickId = null; stickX = 0; knob.style.transform = 'translate(0,0)'; } };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);

// pedals
const pedal = { gas: false, brake: false };
for (const [id, k] of [['gas', 'gas'], ['brake', 'brake']]) {
  const el = $(id); let pid = null;
  el.addEventListener('pointerdown', (e) => { pid = e.pointerId; el.setPointerCapture(pid); pedal[k] = true; el.classList.add('on'); e.preventDefault(); });
  const up = (e) => { if (e.pointerId === pid) { pid = null; pedal[k] = false; el.classList.remove('on'); } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
['contextmenu', 'gesturestart'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

function readInput() {
  let k = 0; if (keys.has('ArrowLeft') || keys.has('KeyA')) k -= 1; if (keys.has('ArrowRight') || keys.has('KeyD')) k += 1;
  input.steer = stickId !== null ? stickX : k;
  input.gas = (pedal.gas || keys.has('ArrowUp') || keys.has('KeyW')) ? 1 : 0;
  input.brake = (pedal.brake || keys.has('ArrowDown') || keys.has('KeyS') || keys.has('Space')) ? 1 : 0;
}

// ---------- speedometer ----------
const MAXK = 260;
(function buildTicks() {
  const g = $('ticks'); let s = '';
  for (let v = 0; v <= MAXK; v += 20) {
    const a = (-135 + (v / MAXK) * 270) * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
    const x1 = 100 + 80 * si, y1 = 100 - 80 * c, x2 = 100 + 70 * si, y2 = 100 - 70 * c, xt = 100 + 58 * si, yt = 100 - 58 * c;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${v > 200 ? '#ff6b6b' : '#fff'}" stroke-width="2.5"/>`;
    s += `<text x="${xt}" y="${yt + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#cfe">${v}</text>`;
  }
  g.innerHTML = s;
})();
const needle = $('needle'), kmhEl = $('kmh');
let shownKmh = 0;
function updateSpeedo(kmh) {
  shownKmh += (kmh - shownKmh) * 0.25;
  needle.setAttribute('transform', `rotate(${-135 + Math.min(shownKmh, MAXK) / MAXK * 270} 100 100)`);
  kmhEl.textContent = Math.round(Math.abs(shownKmh));
}

// ---------- placement / camera ----------
let camYaw = 0, prevSpeed = 0, pitch = 0, roll = 0;
const camPos = new THREE.Vector3(), look = new THREE.Vector3();
function placeCar() {
  carRoot.position.set(S.x, 0.05, S.z); carRoot.rotation.y = S.yaw;
}
function placeCamera(k) {
  const d = 7.5 + Math.min(Math.abs(S.speed), 60) * 0.06, h = 2.6 + Math.min(Math.abs(S.speed), 60) * 0.02;
  const bx = Math.sin(camYaw), bz = Math.cos(camYaw);      // backwards vector
  const tx = S.x + bx * d, tz = S.z + bz * d;
  camPos.set(tx, h + 0.6, tz);
  if (k >= 1) camera.position.copy(camPos); else camera.position.lerp(camPos, k);
  look.set(S.x - bx * 6, 1.1, S.z - bz * 6);
  camera.lookAt(look);
  camera.fov = 62 + Math.min(Math.abs(S.speed) / 78, 1) * 14; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 1 / 20); last = now;
  if (started) {
    readInput();
    const sub = 2;
    for (let i = 0; i < sub; i++) {
      const { dist } = distToCenter(center, S.x, S.z);
      step(S, input, dt / sub, dist > ROAD.half + 0.4);
    }
    placeCar();
    // wheels
    for (const k in wheels) {
      const w = wheels[k]; w.rotation.x = -S.wheelSpin;
      w.rotation.y = k[0] === 'F' ? S.steer : 0;
    }
    // body pitch / roll
    const acc = (S.speed - prevSpeed) / Math.max(dt, 1e-3); prevSpeed = S.speed;
    pitch += (THREE.MathUtils.clamp(acc * 0.0035, -0.05, 0.05) - pitch) * 0.12;
    roll += (THREE.MathUtils.clamp(-(S.yawRate || 0) * S.speed * 0.0035, -0.06, 0.06) - roll) * 0.12;
    tilt.rotation.x = pitch; tilt.rotation.z = roll;
    // camera follows heading smoothly
    let dy = S.yaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    camYaw += dy * (1 - Math.exp(-dt * 4.5));
    placeCamera(1 - Math.exp(-dt * 10));
    updateSpeedo(Math.abs(S.speed) * 3.6);
  }
  renderer.render(scene, camera);
}
resetCar();
requestAnimationFrame(frame);
