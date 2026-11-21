import { makeState, step } from '../js/physics.js';
import { buildCenterline, buildRoadGeometry, distToCenter, ROAD } from '../js/track.js';
let s = makeState(); s.yaw = -Math.PI/2;
for (let i=0;i<60*4;i++) step(s,{steer:0,gas:1,brake:0},1/60,false);
console.log('after 4s full gas: km/h',(s.speed*3.6).toFixed(1));
for (let i=0;i<60*20;i++) step(s,{steer:0,gas:1,brake:0},1/60,false);
console.log('after 24s: km/h',(s.speed*3.6).toFixed(1));
for (let i=0;i<60*4;i++) step(s,{steer:0,gas:0,brake:1},1/60,false);
console.log('after brake 4s: km/h',(s.speed*3.6).toFixed(1));
for (let i=0;i<60*3;i++) step(s,{steer:0,gas:0,brake:1},1/60,false);
console.log('reverse km/h',(s.speed*3.6).toFixed(1));
for (const shape of ['square','circle']) {
  const c = buildCenterline(shape);
  const g = buildRoadGeometry(c);
  const nrm = g.getAttribute('normal'); let up=0; for (let i=0;i<nrm.count;i++) if (nrm.getY(i)>0) up++;
  console.log(shape,'pts',c.length,'start',c[0].x.toFixed(1),c[0].y.toFixed(1),'next',c[1].x.toFixed(1),c[1].y.toFixed(1),
    'verts',g.getAttribute('position').count,'normals up %',(100*up/nrm.count).toFixed(0),
    'dist at start',distToCenter(c,c[0].x,c[0].y).dist.toFixed(2),'road width',ROAD.width.toFixed(2));
}
// steer test: square track, auto-drive in a circle with steer=-1 left
s=makeState();s.yaw=0;for(let i=0;i<60*3;i++)step(s,{steer:-1,gas:0.5,brake:0},1/60,false);
console.log('left turn yaw',s.yaw.toFixed(2),'(expect >0)');
