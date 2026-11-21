// Simple arcade car physics (no DOM / three dependency so it can be unit-tested).
export const CAR = {
  wheelBase: 2.71,
  wheelRadius: 0.36,
  maxSpeed: 78,        // m/s  (~280 km/h)
  maxReverse: 12,
  accel: 8.5,          // m/s^2 at low speed (0-100 km/h in ~3.5 s)
  brake: 14,
  maxSteer: 0.55,      // rad at standstill
  minSteer: 0.07,      // rad at top speed
};

export function makeState() {
  return { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, steer: 0, speed: 0, lat: 0, wheelSpin: 0, offroad: false };
}

// input: { steer: -1..1 (negative = left), gas: 0..1, brake: 0..1 }
// returns nothing; mutates state. offroad = true applies grass drag.
export function step(s, input, dt, offroad) {
  s.offroad = offroad;
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);      // forward
  const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);       // right
  let vf = s.vx * fx + s.vz * fz;
  let vl = s.vx * rx + s.vz * rz;

  // --- longitudinal ---
  const gas = input.gas, brk = input.brake;
  let a = 0;
  if (gas > 0 && vf > -0.5) {
    const k = Math.max(0, 1 - Math.pow(Math.max(vf, 0) / CAR.maxSpeed, 2));
    a += CAR.accel * k * gas;
  }
  if (brk > 0) {
    if (vf > 0.5) a -= CAR.brake * brk;                       // braking
    else if (gas === 0) { if (vf > -CAR.maxReverse) a -= 4.5 * brk; } // reverse
    else a -= CAR.brake * brk;
  }
  // drag + rolling resistance (always opposes motion)
  const drag = 0.25 + 0.0011 * vf * vf + (offroad ? 5 + 0.02 * vf * vf : 0);
  a -= Math.sign(vf) * drag * (gas > 0 || brk > 0 ? 1 : 1.6);
  const before = vf;
  vf += a * dt;
  if (gas === 0 && brk === 0 && Math.sign(before) !== Math.sign(vf)) vf = 0;  // coast to a stop
  if (offroad && vf > 22) vf = Math.max(22, vf - 18 * dt);                    // grass speed cap

  // --- lateral grip (small slide at high speed) ---
  const grip = offroad ? 4 : 9;
  vl *= Math.exp(-grip * dt);

  // --- steering ---
  const speedK = Math.min(1, Math.abs(vf) / 60);
  const maxSteer = CAR.maxSteer + (CAR.minSteer - CAR.maxSteer) * Math.pow(speedK, 0.7);
  const target = -input.steer * maxSteer;            // + = left
  s.steer += (target - s.steer) * (1 - Math.exp(-dt * 9));
  const yawRate = (vf * Math.tan(s.steer)) / CAR.wheelBase;
  s.yaw += yawRate * dt;

  // rebuild velocity in the (new) heading frame
  const nfx = -Math.sin(s.yaw), nfz = -Math.cos(s.yaw);
  const nrx = Math.cos(s.yaw), nrz = -Math.sin(s.yaw);
  s.vx = nfx * vf + nrx * vl;
  s.vz = nfz * vf + nrz * vl;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  s.speed = vf;
  s.lat = vl;
  s.yawRate = yawRate;
  s.wheelSpin += (vf * dt) / CAR.wheelRadius;
}
