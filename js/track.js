// Track = the uploaded road.obj piece (83.4 long x 4.42 wide, 9-point camber profile)
// laid out as a closed loop. The straight piece can't close a loop by itself, so its
// exact width / camber / length are swept around a rounded-square (or circle) centerline.
import * as THREE from 'three';

export const ROAD = {
  tileLength: 83.41,        // measured from road.obj
  tileWidth: 4.42,          // measured from road.obj
  widthScale: 1.8,          // road.obj is narrow for a 2 m wide car, so widen it a bit
  // camber from road.obj (cross-section, left -> right), height relative to centre
  profile: [-0.021, 0.021, 0, 0, 0, 0, 0, 0.021, -0.021],
};
ROAD.width = ROAD.tileWidth * ROAD.widthScale;
ROAD.half = ROAD.width / 2;

export function buildCenterline(shape = 'square') {
  const pts = [];
  const step = 2;
  if (shape === 'circle') {
    const R = 130, n = Math.round((2 * Math.PI * R) / step);
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 - (i / n) * Math.PI * 2;      // start at (0,R) heading +x, turning left
      pts.push(new THREE.Vector2(R * Math.cos(a), R * Math.sin(a)));
    }
    return pts;
  }
  // rounded square: every straight side is exactly 2 road tiles long
  const S = ROAD.tileLength, Rc = 60, A = S + Rc;
  const line = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / step);
    for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n));
  };
  const arc = (cx, cz, a0, a1) => {
    const len = Math.abs(a1 - a0) * Rc, n = Math.round(len / step);
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      pts.push(new THREE.Vector2(cx + Rc * Math.cos(a), cz + Rc * Math.sin(a)));
    }
  };
  const h = Math.PI / 2;
  line(-S, A, S, A);   arc(S, S, h, 0);
  line(A, S, A, -S);   arc(S, -S, 0, -h);
  line(S, -A, -S, -A); arc(-S, -S, -h, -2 * h);
  line(-A, -S, -A, S); arc(-S, S, -2 * h, -3 * h);
  // shift so index 0 is the middle of the first straight (start/finish)
  let mid = 0, bestD = 1e9;
  pts.forEach((p, i) => { const d = Math.abs(p.x) + (p.y > A - 1 ? 0 : 1000); if (d < bestD) { bestD = d; mid = i; } });
  return pts.slice(mid).concat(pts.slice(0, mid));
}

export function buildRoadGeometry(center) {
  const n = center.length, prof = ROAD.profile, m = prof.length;
  const pos = [], uv = [], idx = [];
  let total = 0;
  const seg = [];
  for (let i = 0; i <= n; i++) {
    const a = center[i % n], b = center[(i + 1) % n];
    seg.push(total); total += a.distanceTo(b);
  }
  const period = total / Math.max(1, Math.round(total / 16));   // dash pattern repeats cleanly
  for (let i = 0; i <= n; i++) {
    const p = center[i % n], q = center[(i + 1) % n], o = center[(i - 1 + n) % n];
    const t = new THREE.Vector2().subVectors(q, o).normalize();
    const nx = -t.y, nz = t.x;       // left normal in x/z plane
    for (let j = 0; j < m; j++) {
      const k = (j / (m - 1)) * 2 - 1;           // -1 .. 1 across the road
      const off = -k * ROAD.half;               // j=0 is the right edge
      pos.push(p.x + nx * off, 0.05 + prof[j], p.y + nz * off);
      uv.push(j / (m - 1), seg[i] / period);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// distance from a point to the centerline (closed polyline) + nearest point index
export function distToCenter(center, x, z) {
  let best = 1e9, bi = 0;
  const n = center.length;
  for (let i = 0; i < n; i++) {
    const a = center[i], b = center[(i + 1) % n];
    const abx = b.x - a.x, abz = b.y - a.y;
    let t = ((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz);
    t = Math.max(0, Math.min(1, t));
    const dx = x - (a.x + abx * t), dz = z - (a.y + abz * t);
    const d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  return { dist: Math.sqrt(best), index: bi };
}
