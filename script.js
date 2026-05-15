// ─── Config ───────────────────────────────────────────────────────────────────
//
// SETUP FIREBASE (solo una vez):
//   1. Ve a https://console.firebase.google.com y crea un proyecto.
//   2. En el proyecto, entra en "Realtime Database" → "Crear base de datos".
//   3. Empieza en modo prueba (permite lectura y escritura durante 30 días).
//      Para uso permanente, pon estas reglas en la pestaña "Reglas":
//        {
//          "rules": {
//            "lastTrack": {
//              ".read": true,
//              ".write": true
//            }
//          }
//        }
//   4. Copia la URL de tu base de datos (algo como
//      https://TU-PROYECTO-default-rtdb.firebaseio.com)
//      y pégala en FIREBASE_DB_URL de abajo.
//
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_DB_URL = 'https://test-1b021-default-rtdb.europe-west1.firebasedatabase.app';

const MEDIA = {
  music: {
    lastfmUser:   'Wilford_Studios',
    lastfmApiKey: 'f13d8b297568b04f7cfa22684044b6bd',
    fallbackUrl:  'https://open.spotify.com/user/r94decpncosw8hogydivy5ma3',
    refreshMs:    1_000, // 1 s — razonable para la API de Last.fm
  },
};

// ─── State ────────────────────────────────────────────────────────────────────

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root   = document.documentElement;
const canvas = document.getElementById('bg-canvas');
const ctx    = canvas?.getContext('2d');

let wasPlaying  = false;   // ¿estaba sonando en el último poll?
let liveTrack   = null;    // canción que está sonando ahora mismo
let sharedTrack = null;    // última canción guardada en Firebase

// ─── Firebase helpers ─────────────────────────────────────────────────────────

async function firebaseGet() {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/lastTrack.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json(); // null si el nodo no existe todavía
  } catch {
    return null;
  }
}

async function firebasePut(track) {
  try {
    await fetch(`${FIREBASE_DB_URL}/lastTrack.json`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(track),
    });
  } catch {
    // silencioso — la próxima vez que pare una canción se volverá a intentar
  }
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab, el) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`tab-${tab}`);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
}

// ─── Media card renderer ──────────────────────────────────────────────────────

function setMediaCard(id, { title, coverUrl, href, isPlaying = false }) {
  const card    = document.getElementById(`mc-${id}`);
  const coverEl = document.getElementById(`mc-${id}-cover`);
  const titleEl = document.getElementById(`mc-${id}-title`);
  const linkEl  = document.getElementById(`mc-${id}-link`);

  if (!card) return;

  card.dataset.state   = 'loaded';
  card.dataset.playing = String(isPlaying);

  if (titleEl) titleEl.textContent = title || '—';
  if (linkEl && href) linkEl.href = href;

  if (coverEl) {
    coverEl.innerHTML = '';
    if (coverUrl) {
      const img   = document.createElement('img');
      img.src     = coverUrl;
      img.alt     = '';
      img.loading = 'lazy';
      img.onerror = () => {
        coverEl.innerHTML = '';
        const ph = document.createElement('span');
        ph.className   = 'mc-ph-icon';
        ph.textContent = '♫';
        coverEl.appendChild(ph);
      };
      coverEl.appendChild(img);
    } else {
      const ph = document.createElement('span');
      ph.className   = 'mc-ph-icon';
      ph.textContent = '♫';
      coverEl.appendChild(ph);
    }
  }
}

// ─── Last.fm fetch ────────────────────────────────────────────────────────────

async function fetchMusicCard() {
  const track = await firebaseGet();
  if (!track) return;
  setMediaCard('music', { ...track, isPlaying: track.isPlaying ?? false });
}

// ─── Music card — init ────────────────────────────────────────────────────────

async function initMusicCard() {
  const card = document.getElementById('mc-music');
  if (card) card.dataset.state = 'loading';

  // Cargar desde Firebase primero para que los visitantes vean algo de inmediato
  sharedTrack = await firebaseGet();
  if (sharedTrack) {
    setMediaCard('music', { ...sharedTrack, isPlaying: false });
  }

  // Función de polling con fallback
  const poll = () =>
    fetchMusicCard().catch(() => {
      const fallback = sharedTrack;
      setMediaCard('music',
        fallback
          ? { ...fallback, isPlaying: false }
          : { title: 'spotify', coverUrl: '', href: MEDIA.music.fallbackUrl }
      );
    });

  poll();
  setInterval(poll, MEDIA.music.refreshMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) poll();
  });
}

// ─── 3D tilt en cards ─────────────────────────────────────────────────────────

function bindCardInteractions() {
  document.querySelectorAll('.glass-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x  = event.clientX - rect.left;
      const y  = event.clientY - rect.top;
      const px = x / rect.width  - 0.5;
      const py = y / rect.height - 0.5;

      card.style.setProperty('--card-x', `${x}px`);
      card.style.setProperty('--card-y', `${y}px`);

      if (!prefersReducedMotion) {
        card.style.transform =
          `translateY(-2px) rotateX(${-py * 2.8}deg) rotateY(${px * 3.2}deg)`;
      }
    });

    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
      card.style.removeProperty('--card-x');
      card.style.removeProperty('--card-y');
    });
  });
}

// ─── Fondo de partículas ──────────────────────────────────────────────────────

let particles      = [];
let animationFrame = null;
let pointerX       = window.innerWidth  / 2;
let pointerY       = window.innerHeight / 2;

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(window.innerWidth  * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(90, Math.max(42, Math.floor(window.innerWidth / 16)));
  particles = Array.from({ length: count }, () => ({
    x:      Math.random() * window.innerWidth,
    y:      Math.random() * window.innerHeight,
    radius: Math.random() * 1.5 + 0.35,
    vx:     (Math.random() - 0.5) * 0.14,
    vy:     (Math.random() - 0.5) * 0.14,
    alpha:  Math.random() * 0.36 + 0.1,
  }));
}

function drawBackground() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach(p => {
    const dx   = pointerX - p.x;
    const dy   = pointerY - p.y;
    const dist = Math.hypot(dx, dy);
    const pull = Math.max(0, 1 - dist / 460) * 0.014;
    p.x += p.vx + dx * pull;
    p.y += p.vy + dy * pull;
    if (p.x < -10) p.x = window.innerWidth  + 10;
    if (p.x > window.innerWidth  + 10) p.x = -10;
    if (p.y < -10) p.y = window.innerHeight + 10;
    if (p.y > window.innerHeight + 10) p.y = -10;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(188,218,230,${p.alpha})`;
    ctx.fill();
  });

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i], b = particles[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 110) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(184,216,229,${(1 - d / 110) * 0.09})`;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
    }
  }

  animationFrame = requestAnimationFrame(drawBackground);
}

function initBackground() {
  if (!canvas || !ctx || prefersReducedMotion) return;
  resizeCanvas();
  drawBackground();
  window.addEventListener('resize', resizeCanvas);
}

// ─── Pointer tracking ─────────────────────────────────────────────────────────

document.addEventListener('pointermove', e => {
  pointerX = e.clientX;
  pointerY = e.clientY;
  root.style.setProperty('--mouse-x', `${e.clientX}px`);
  root.style.setProperty('--mouse-y', `${e.clientY}px`);
}, { passive: true });

document.addEventListener('pointerleave', () => {
  pointerX = window.innerWidth  / 2;
  pointerY = window.innerHeight / 2;
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

initMusicCard();
bindCardInteractions();
initBackground();

window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});
