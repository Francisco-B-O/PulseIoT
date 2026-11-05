// Scroll reveal
const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });

// Counters
const co = new IntersectionObserver((es) => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target, to = +el.dataset.to, t0 = performance.now();
  const tick = (t) => { const p = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + (p === 1 && to > 100 ? '+' : ''); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick); co.unobserve(el);
}), { threshold: .6 });
document.querySelectorAll('.num').forEach(n => co.observe(n));

// Hero tilt
const tilt = document.querySelector('.tilt .frame');
if (tilt && matchMedia('(pointer:fine)').matches) {
  const host = tilt.parentElement;
  host.addEventListener('mousemove', e => {
    const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    tilt.style.transform = `rotateY(${x * 7}deg) rotateX(${-y * 6}deg)`;
  });
  host.addEventListener('mouseleave', () => tilt.style.transform = '');
}

// Gallery
let shot = 'dashboard', light = false;
const img = document.getElementById('gimg'), title = document.getElementById('gtitle'), themeBtn = document.getElementById('themeBtn');
function show() {
  img.style.opacity = 0;
  setTimeout(() => { img.src = `assets/${shot}${light ? '-light' : ''}.png`; title.textContent = 'pulseiot / ' + shot; }, 180);
  img.onload = () => img.style.opacity = 1;
}
document.querySelectorAll('.tabs button[data-s]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button[data-s]').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); shot = b.dataset.s; show();
}));
themeBtn.addEventListener('click', () => { light = !light; themeBtn.textContent = light ? '☀ Light' : '☾ Dark'; show(); });

// Background: telemetry packets travelling across a faint grid
const cv = document.getElementById('stream'), ctx = cv.getContext('2d');
let W, H, lanes = [];
function resize() {
  W = cv.width = innerWidth; H = cv.height = innerHeight;
  lanes = Array.from({ length: Math.max(6, Math.floor(H / 120)) }, (_, i) => ({ y: 60 + i * (H / Math.max(6, Math.floor(H / 120))), packets: [] }));
}
addEventListener('resize', resize); resize();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  (function loop() {
    ctx.clearRect(0, 0, W, H);
    for (const l of lanes) {
      ctx.strokeStyle = 'rgba(34,211,238,.05)'; ctx.beginPath(); ctx.moveTo(0, l.y); ctx.lineTo(W, l.y); ctx.stroke();
      if (Math.random() < .012) l.packets.push({ x: -20, v: 1.2 + Math.random() * 2.6, anomaly: Math.random() < .08 });
      l.packets = l.packets.filter(p => p.x < W + 30);
      for (const p of l.packets) {
        p.x += p.v;
        const c = p.anomaly ? '248,113,113' : '34,211,238';
        const g = ctx.createLinearGradient(p.x - 60, 0, p.x, 0);
        g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},.8)`);
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 60, l.y); ctx.lineTo(p.x, l.y); ctx.stroke();
        ctx.fillStyle = `rgba(${c},1)`; ctx.beginPath(); ctx.arc(p.x, l.y, p.anomaly ? 3.5 : 2.2, 0, 7); ctx.fill();
      }
    }
    requestAnimationFrame(loop);
  })();
}
