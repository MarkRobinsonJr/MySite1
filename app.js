const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d', { alpha: false });
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let w = 0, h = 0, cx = 0, cy = 0;
let mode = 'orbit';
let particles = [];
let ripples = [];
let pointer = { x: 0, y: 0, active: false, down: false };
let last = performance.now();
let fpsSmooth = 60;
let energy = 0.842;
let entropy = 0.31;
let velocityMetric = 0;
let huePhase = 0;

const cfg = {
  orbit: { count: 520, pull: 0.00155, drag: 0.9965, swirl: 0.00034, jitter: 0.003 },
  drift: { count: 410, pull: 0.00028, drag: 0.9988, swirl: 0.00005, jitter: 0.008 },
  chaos: { count: 650, pull: 0.0025, drag: 0.992, swirl: 0.00115, jitter: 0.06 }
};

function resize() {
  w = innerWidth; h = innerHeight; cx = w / 2; cy = h / 2;
  canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!particles.length) reset();
}

class Particle {
  constructor(seed = Math.random()) {
    const a = Math.random() * Math.PI * 2;
    const minR = Math.min(w, h) * 0.08;
    const maxR = Math.hypot(w, h) * 0.56;
    const r = minR + Math.pow(Math.random(), .68) * (maxR - minR);
    this.x = cx + Math.cos(a) * r;
    this.y = cy + Math.sin(a) * r * 0.62;
    const speed = 0.16 + Math.random() * 0.48;
    this.vx = -Math.sin(a) * speed;
    this.vy = Math.cos(a) * speed;
    this.size = 0.35 + Math.random() * 1.35;
    this.alpha = 0.16 + Math.random() * 0.72;
    this.depth = 0.25 + Math.random() * 1.2;
    this.life = Math.random() * 1000;
    this.tint = seed > .94 ? 1 : seed > .86 ? 2 : 0;
    this.trail = [];
  }
}

function desiredCount() {
  const base = cfg[mode].count;
  const areaFactor = Math.min(1.2, Math.max(.55, (w * h) / (1440 * 900)));
  return Math.round(base * areaFactor);
}

function reset() {
  particles = Array.from({ length: desiredCount() }, () => new Particle());
  ripples = [];
}

function addBurst(x, y, amount = 34) {
  for (let i = 0; i < amount; i++) {
    const p = new Particle();
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 18;
    p.x = x + Math.cos(a) * r;
    p.y = y + Math.sin(a) * r;
    const s = 0.7 + Math.random() * 2.8;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.alpha = .45 + Math.random() * .55;
    particles.push(p);
  }
  ripples.push({ x, y, r: 4, a: .75 });
  energy = Math.min(1.75, energy + .16);
}

function pulse() {
  const x = pointer.active ? pointer.x : cx;
  const y = pointer.active ? pointer.y : cy;
  ripples.push({ x, y, r: 8, a: 1 });
  for (const p of particles) {
    const dx = p.x - x, dy = p.y - y;
    const d = Math.max(40, Math.hypot(dx, dy));
    const force = Math.min(5.5, 800 / d);
    p.vx += dx / d * force;
    p.vy += dy / d * force;
  }
  energy = Math.min(1.95, energy + .35);
}

function update(dt) {
  const c = cfg[mode];
  let speedSum = 0;
  const mouseRadius = Math.min(w, h) * .34;

  for (const p of particles) {
    let dx = cx - p.x, dy = cy - p.y;
    let d = Math.max(70, Math.hypot(dx, dy));
    const g = c.pull * (mode === 'chaos' ? 1.2 : 1);
    p.vx += dx * g * dt;
    p.vy += dy * g * dt;

    // Tangential energy keeps the system orbiting rather than collapsing.
    p.vx += (-dy / d) * c.swirl * d * dt * 6;
    p.vy += ( dx / d) * c.swirl * d * dt * 6;

    if (pointer.active) {
      const mx = pointer.x - p.x, my = pointer.y - p.y;
      const md = Math.max(18, Math.hypot(mx, my));
      if (md < mouseRadius) {
        const fall = 1 - md / mouseRadius;
        const sign = pointer.down ? -1 : 1;
        const f = fall * .038 * p.depth * sign * dt;
        p.vx += mx / md * f;
        p.vy += my / md * f;
        p.vx += -my / md * fall * .012 * dt;
        p.vy +=  mx / md * fall * .012 * dt;
      }
    }

    p.vx += (Math.random() - .5) * c.jitter * dt;
    p.vy += (Math.random() - .5) * c.jitter * dt;
    p.vx *= Math.pow(c.drag, dt);
    p.vy *= Math.pow(c.drag, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life += dt;

    if (p.trail.length > (mode === 'chaos' ? 2 : 4)) p.trail.shift();
    if (p.size > .8 && p.depth > .7) p.trail.push([p.x, p.y]);

    const margin = 120;
    if (p.x < -margin || p.x > w + margin || p.y < -margin || p.y > h + margin) {
      Object.assign(p, new Particle());
    }
    speedSum += Math.hypot(p.vx, p.vy);
  }

  // Trim burst-created particles gradually.
  const target = desiredCount();
  if (particles.length > target && Math.random() < .08 * dt) particles.splice(Math.floor(Math.random() * particles.length), 1);

  ripples.forEach(r => { r.r += 3.2 * dt; r.a *= Math.pow(.94, dt); });
  ripples = ripples.filter(r => r.a > .025);

  velocityMetric = speedSum / Math.max(1, particles.length);
  energy += (0.74 + Math.min(.48, velocityMetric * .045) - energy) * .012 * dt;
  entropy += ((mode === 'chaos' ? .87 : mode === 'drift' ? .22 : .41) - entropy) * .01 * dt;
  huePhase += .001 * dt;
}

function draw() {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .72);
  grad.addColorStop(0, mode === 'chaos' ? '#0b0a14' : '#090b11');
  grad.addColorStop(.58, '#06070b');
  grad.addColorStop(1, '#030408');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Faint architectural grid.
  ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 1;
  const gap = 72;
  ctx.beginPath();
  for (let x = (cx % gap); x < w; x += gap) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = (cy % gap); y < h; y += gap) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  // Central halo.
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w,h) * .22);
  halo.addColorStop(0, 'rgba(216,255,103,.055)');
  halo.addColorStop(.35, 'rgba(114,232,255,.018)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  for (const p of particles) {
    if (p.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(p.trail[0][0], p.trail[0][1]);
      for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i][0], p.trail[i][1]);
      ctx.strokeStyle = `rgba(255,255,255,${p.alpha * .035})`;
      ctx.lineWidth = .55;
      ctx.stroke();
    }
    const shimmer = .75 + Math.sin(p.life * .025) * .25;
    const a = p.alpha * shimmer;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.depth, 0, Math.PI * 2);
    if (p.tint === 1) ctx.fillStyle = `rgba(216,255,103,${a})`;
    else if (p.tint === 2) ctx.fillStyle = `rgba(114,232,255,${a})`;
    else ctx.fillStyle = `rgba(238,243,255,${a})`;
    ctx.fill();
  }

  for (const r of ripples) {
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(216,255,103,${r.a * .38})`; ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (pointer.active) {
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(216,255,103,.22)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(216,255,103,.8)'; ctx.fill();
  }
}

function frame(now) {
  const rawDt = Math.min(2.5, (now - last) / 16.667);
  last = now;
  fpsSmooth += ((60 / Math.max(.1, rawDt)) - fpsSmooth) * .05;
  update(rawDt);
  draw();
  requestAnimationFrame(frame);
}

function setMode(next) {
  mode = next;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const target = desiredCount();
  while (particles.length < target) particles.push(new Particle());
  energy += .08;
}

function updateTelemetry() {
  const clock = document.getElementById('clock');
  const now = new Date();
  clock.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
  document.getElementById('particles').textContent = String(particles.length).padStart(3, '0');
  document.getElementById('velocity').textContent = velocityMetric.toFixed(2);
  document.getElementById('entropy').textContent = entropy.toFixed(2);
  document.getElementById('energy').textContent = energy.toFixed(3);
  document.getElementById('fps').textContent = String(Math.round(Math.min(99, fpsSmooth)));
  document.getElementById('signal').textContent = (97.8 + Math.random() * 1.7).toFixed(1) + '%';
}

addEventListener('resize', resize);
addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  document.getElementById('coords').textContent = `X ${String(Math.round(e.clientX)).padStart(4,'0')} / Y ${String(Math.round(e.clientY)).padStart(4,'0')}`;
});
addEventListener('pointerleave', () => pointer.active = false);
addEventListener('pointerdown', e => {
  if (e.target.closest('button,dialog,a')) return;
  pointer.down = true;
  addBurst(e.clientX, e.clientY, mode === 'chaos' ? 52 : 34);
});
addEventListener('pointerup', () => pointer.down = false);

const dialog = document.getElementById('infoDialog');
document.addEventListener('click', e => {
  const modeButton = e.target.closest('[data-mode]');
  if (modeButton) return setMode(modeButton.dataset.mode);
  const actionButton = e.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === 'pulse') pulse();
  if (action === 'focus') document.body.classList.toggle('focus');
  if (action === 'reset') reset();
  if (action === 'info') dialog.showModal();
  if (action === 'close') dialog.close();
});

document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'f') document.body.classList.toggle('focus');
  if (e.key.toLowerCase() === 'r') reset();
  if (e.key === '1') setMode('orbit');
  if (e.key === '2') setMode('drift');
  if (e.key === '3') setMode('chaos');
  if (e.code === 'Space') { e.preventDefault(); pulse(); }
  if (e.key === 'Escape' && dialog.open) dialog.close();
});

resize();
setTimeout(() => document.getElementById('boot').classList.add('done'), 1550);
setInterval(updateTelemetry, 500);
updateTelemetry();
requestAnimationFrame(frame);
