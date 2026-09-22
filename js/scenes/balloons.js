import { ControllerBeam } from "../render/core/controllerInput.js";

const PHYS = {
   G          : 9.81,
   RHO_AIR    : 1.225,
   RHO_HE     : 0.169,
   CD         : 0.47,
   SHELL_MASS : 0.0028,
   STR_N      : 13,
   STR_LEN    : 1.2,
   STR_MASS   : 0.0006,
   FIXED_DT   : 1/90,
   ITER       : 20,
   DAMP_STR   : 0.996,
   DAMP_BALL  : 0.999,
   WANDER     : 0.35,
   FLOOR_Y    : 0.002,
   FRICTION   : 0.5,
   CEILING_Y  : 3.2,
   MAX_DRAG_A : 25,
};

const vAdd   = (a,b) => [ a[0]+b[0], a[1]+b[1], a[2]+b[2] ];
const vSub   = (a,b) => [ a[0]-b[0], a[1]-b[1], a[2]-b[2] ];
const vScale = (a,s) => [ a[0]*s, a[1]*s, a[2]*s ];
const vDot   = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const vLen   = a => Math.sqrt(vDot(a,a));
const vMix   = (a,b,t) => [ a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t ];

class Particle {
   constructor(pos, mass) {
      this.x  = pos.slice();
      this.xp = pos.slice();
      this.w  = 1 / mass;
      this.pin = null;
   }
}

class BalloonRope {

   constructor(pos, r) {
      this.r    = r;
      const V   = 4/3 * Math.PI * r*r*r;
      const mHe = PHYS.RHO_HE * V;
      const mSh = PHYS.SHELL_MASS * (r/.11)*(r/.11);
      this.mTot = mHe + mSh;
      this.A    = Math.PI * r * r;
      this.aUp  = ((PHYS.RHO_AIR - PHYS.RHO_HE) * V / this.mTot - 1) * PHYS.G;
      this.seed   = Math.random() * 100;
      this.segLen = PHYS.STR_LEN / (PHYS.STR_N - 1);
      this.popped = false;

      this.p = [ new Particle(vAdd(pos, [0, .06, 0]), this.mTot) ];
      for (let i = 0 ; i < PHYS.STR_N ; i++)
         this.p.push(new Particle(vAdd(pos, [0, -.05 - i*this.segLen, 0]),
                                  PHYS.STR_MASS / PHYS.STR_N));

      this.cons = [ [0, 1, r] ];
      for (let i = 1 ; i < PHYS.STR_N ; i++)
         this.cons.push([i, i+1, this.segLen]);
   }

   step(dt, time) {
      const n = this.popped ? 1 : 0;
      for (let i = n ; i < this.p.length ; i++) {
         const p = this.p[i];
         if (p.pin) {
            p.xp = p.x;
            p.x  = p.pin.slice();
            continue;
         }
         const v = vSub(p.x, p.xp);
         let a;
         if (i === 0) {
            const speed = vLen(v) / dt;
            const w = this.seed;
            a = [ PHYS.WANDER * Math.sin(time*.61 + w    ) +
                  PHYS.WANDER * Math.sin(time*.23 + w*1.7) * .5,
                  this.aUp,
                  PHYS.WANDER * Math.cos(time*.57 + w*2.3) +
                  PHYS.WANDER * Math.sin(time*.29 + w*3.1) * .5 ];
            if (speed > 1e-6) {
               const dragA = Math.min(.5 * PHYS.RHO_AIR * PHYS.CD * this.A *
                                      speed * speed / this.mTot, PHYS.MAX_DRAG_A);
               a = vAdd(a, vScale(v, -dragA / vLen(v)));
            }
            p.xp = p.x;
            p.x  = vAdd(vAdd(p.x, vScale(v, PHYS.DAMP_BALL)), vScale(a, dt*dt));
         } else {
            p.xp = p.x;
            p.x  = vAdd(vAdd(p.x, vScale(v, PHYS.DAMP_STR)),
                        vScale([0, -PHYS.G, 0], dt*dt));
         }
      }

      for (let k = 0 ; k < PHYS.ITER ; k++) {
         for (let c = n ; c < this.cons.length ; c++) {
            const [i, j, rest] = this.cons[c];
            const pi = this.p[i], pj = this.p[j];
            const d  = vSub(pj.x, pi.x);
            const len = vLen(d);
            if (len < 1e-9) continue;
            const wSum = pi.w + pj.w;
            const diff = (len - rest) / len;
            pi.x = vAdd(pi.x, vScale(d,  pi.w / wSum * diff));
            pj.x = vAdd(pj.x, vScale(d, -pj.w / wSum * diff));
         }
         for (let i = n ; i < this.p.length ; i++)
            if (this.p[i].pin)
               this.p[i].x = this.p[i].pin.slice();
      }

      for (let i = n ; i < this.p.length ; i++) {
         const p = this.p[i];
         if (p.x[1] < PHYS.FLOOR_Y) {
            p.x[1] = PHYS.FLOOR_Y;
            p.xp[0] += (p.x[0] - p.xp[0]) * PHYS.FRICTION;
            p.xp[2] += (p.x[2] - p.xp[2]) * PHYS.FRICTION;
         }
      }
   }

   nearest(pos) {
      let best = -1, bestD = 1e9;
      const start = this.popped ? 1 : 0;
      for (let i = start ; i < this.p.length ; i++) {
         const d = vLen(vSub(this.p[i].x, pos));
         if (d < bestD) { bestD = d; best = i; }
      }
      return [best, bestD];
   }

   rayHit(origin, dir) {
      if (this.popped) return -1;
      const toC = vSub(this.p[0].x, origin);
      const t = vDot(toC, dir);
      if (t <= 0) return -1;
      const closest = vAdd(origin, vScale(dir, t));
      const miss = vLen(vSub(this.p[0].x, closest)) - this.r;
      return miss <= 0 ? t : -1;
   }

   pop() { this.popped = true; }
}

const PALETTE = [
   [1.0,.15,.15], [1.0,.45,.05], [1.0,.82,.10], [.20,.72,.25],
   [.10,.72,.85], [.15,.35,1.0], [.55,.20,.90], [1.0,.35,.70] ];

export const init = async model => {

   const MAX_BALLOONS = 10;
   const GRAB_RADIUS  = .08;

   let uid = 0;
   const ropes = [];
   const effects = [];
   const beamR = new ControllerBeam(model, 'right');

   const buzz = (hand, intensity, ms) => { if (window.vibrate) vibrate(hand, intensity, ms); };

   const spawnBalloon = (pos, pinTo) => {
      const r = .09 + Math.random() * .04;
      const c = PALETTE[Math.random() * PALETTE.length >> 0]
                    .map(v => v * (.9 + .2*Math.random()));
      const rope = new BalloonRope(pos, r);
      if (pinTo) rope.p[PHYS.STR_N].pin = pinTo.slice();

      rope.sphere = model.add('sphere').color(c).opacity(.9);
      rope.knot   = model.add('sphere3').color(.15,.15,.15);
      rope.wire   = model.add(clay.wire(20, 6, 'balloonStr' + (uid++)))
                         .color(.85,.85,.85);
      rope.color  = c;
      ropes.push(rope);

      const alive = ropes.filter(b => !b.popped && b !== rope);
      if (alive.length >= MAX_BALLOONS)
         popBalloon(alive.find(b => ! b.p[PHYS.STR_N].pin) || alive[0]);
      return rope;
   };

   const popBalloon = rope => {
      if (rope.popped) return;
      rope.pop();
      rope.popAt = model.time;
      const pos = rope.p[0].x.slice();

      effects.push({ age: 0, life: .25, tick: (e, k) =>
         rope.sphere.identity().move(pos).scale(rope.r * (1 + .6*k))
                    .opacity(.9 * (1 - k)),
         done: () => model.remove(rope.sphere) });

      for (let i = 0 ; i < 6 ; i++) {
         const scrap = model.add('sphere3').color(rope.color).opacity(.95);
         const dir = [ Math.random()-.5, Math.random()*.7, Math.random()-.5 ];
         const vel = vScale(dir, 1.5 + Math.random()*1.5);
         effects.push({ age: 0, life: .6, scrap, pos: pos.slice(), vel,
            tick: (e, k) => {
               e.vel[1] -= PHYS.G * (1/60);
               e.pos = vAdd(e.pos, vScale(e.vel, 1/60));
               scrap.identity().move(e.pos).scale(.014 * (1 - .8*k))
                    .opacity(.95 * (1 - k));
            },
            done: () => model.remove(scrap) });
      }
      model.remove(rope.knot);
   };

   const findGrab = pos => {
      let best = null;
      for (const rope of ropes) {
         if (rope.gone) continue;
         const [i, d] = rope.nearest(pos);
         const reach = i === 0 ? rope.r + .05 : GRAB_RADIUS;
         if (d < reach && (!best || d < best.d))
            best = { rope, i, d, offset: vSub(rope.p[i].x, pos) };
      }
      return best;
   };

   const sampleRope = (pts, u) => {
      const n = pts.length - 1;
      const f = Math.min(Math.max(u, 0), 1) * n;
      const i = Math.min(f >> 0, n - 1), t = f - i;
      const p0 = pts[Math.max(i-1, 0)], p1 = pts[i],
            p2 = pts[i+1], p3 = pts[Math.min(i+2, n)];
      const t2 = t*t, t3 = t2*t;
      return [0,1,2].map(j => .5 * (2*p1[j] + (-p0[j]+p2[j])*t +
            (2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2 + (-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3));
   };

   let prevL = false, prevR = false, grab = null;
   inputEvents.onPress = () => {};
   inputEvents.onDrag  = () => {};
   inputEvents.onRelease = () => {};
   inputEvents.onMove = () => {};
   inputEvents.onClick = () => {};
   inputEvents.onDoublePress = () => {};

   for (const anchor of [[-.5,-.4],[.55,-.3],[.05,.6]])
      spawnBalloon([anchor[0], 1.5, anchor[1]],
                   [anchor[0], PHYS.FLOOR_Y, anchor[1]]);

   model.animate(() => {
      const dt = Math.min(model.deltaTime || 1/30, 1/30);
      const time = model.time;
      const L = inputEvents.pos('left');
      const lDown = inputEvents.isPressed('left');
      const rDown = inputEvents.isPressed('right');

      beamR.update();
      const bm = beamR.beamMatrix();
      const origin = bm.slice(12,15);
      const dir = vScale([bm[8],bm[9],bm[10]], -1);
      let hover = null;
      for (const rope of ropes) {
         const t = rope.rayHit(origin, dir);
         if (t >= 0 && (!hover || t < hover.t))
            hover = { rope, t };
      }
      if (hover && (time % .15) < .05)
         buzz('right', .3, 20);
      if (rDown && !prevR && hover) {
         popBalloon(hover.rope);
         buzz('right', 1, 100);
      }

      if (L) {
         if (lDown && !prevL) {
            grab = findGrab(L);
            if (! grab) {
               const rope = spawnBalloon(L);
               grab = { rope, i: PHYS.STR_N, offset: [0,-.05,0] };
               buzz('left', .4, 30);
            }
            grab.rope.wire.color(1,.85,.25);
         }
         if (!lDown && prevL && grab) {
            grab.rope.wire.color(.85,.85,.85);
            grab.rope.p[grab.i].pin = null;
            grab = null;
         }
         if (grab)
            grab.rope.p[grab.i].pin = vAdd(L, grab.offset);
      }
      prevL = lDown; prevR = rDown;

      let acc = dt, steps = 0;
      while (acc >= PHYS.FIXED_DT && steps < 4) {
         for (const rope of ropes) rope.step(PHYS.FIXED_DT, time);
         acc -= PHYS.FIXED_DT; steps++;
      }
      if (steps === 4) acc = 0;

      const alive = ropes.filter(r => !r.popped);
      for (let i = 0 ; i < alive.length ; i++)
         for (let j = i+1 ; j < alive.length ; j++) {
            const a = alive[i].p[0].x, b = alive[j].p[0].x;
            const d = vSub(b, a), dist = vLen(d), min = alive[i].r + alive[j].r;
            if (dist > 1e-6 && dist < min) {
               const push = vScale(d, (min - dist) / dist * .5);
               alive[i].p[0].x = vSub(a, push);
               alive[j].p[0].x = vAdd(b, push);
            }
         }

      for (const rope of alive)
         if (rope.p[0].x[1] > PHYS.CEILING_Y && !rope.p[PHYS.STR_N].pin)
            popBalloon(rope);

      for (const rope of ropes) {
         if (rope.popped) {
            clay.animateWire(rope.wire, .0015, u => sampleRope(
               rope.p.slice(1), u));
            continue;
         }
         rope.sphere.identity().move(rope.p[0].x).scale(rope.r);
         rope.knot.identity().move(rope.p[1].x).scale(.008);
         clay.animateWire(rope.wire, .0015, u => sampleRope(
            rope.p.slice(1), u));
      }

      for (let i = ropes.length - 1 ; i >= 0 ; i--) {
         const rope = ropes[i];
         if (rope.popped && time - rope.popAt > 15) {
            rope.gone = true;
            model.remove(rope.wire);
            ropes.splice(i, 1);
         }
      }

      for (let i = effects.length - 1 ; i >= 0 ; i--) {
         const e = effects[i];
         e.age += dt;
         const k = Math.min(e.age / e.life, 1);
         e.tick(e, k);
         if (k >= 1) {
            if (e.done) e.done();
            effects.splice(i, 1);
         }
      }
   });
}
