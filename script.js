const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const canvas = document.getElementById('bg-canvas');
const ctx = canvas?.getContext('2d');

// ─── Media Cards Config ───────────────────────────────────────────────────────

const MEDIA = {
  music: {
    lastfmUser:   'Wilford_Studios',
    lastfmApiKey: 'f13d8b297568b04f7cfa22684044b6bd',
    fallbackUrl:  'https://open.spotify.com/user/r94decpncosw8hogydivy5ma3',
    refreshMs:    15000,
  },
  film: {
    letterboxdUser: 'Wilford_Studios',
    fallbackUrl:    'https://letterboxd.com/Wilford_Studios',
    refreshMs:      120000,
  },
  series: {
    serializdUser: 'Wilford_Studios',
    fallbackUrl:   'https://serializd.com/user/Wilford_Studios',
    refreshMs:     120000,
  },
};

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab, el) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`tab-${tab}`);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function updateClock() {
  const time = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = time;
}

// ─── Media Cards — helpers ────────────────────────────────────────────────────

/**
 * Populate one media card with live data.
 * @param {string} id        — 'music' | 'film'
 * @param {object} opts
 *   title     {string}
 *   coverUrl  {string}   — full image URL, or '' for no image
 *   href      {string}   — link target
 *   isPlaying {boolean}  — show green dot (music only)
 */
function setMediaCard(id, { title, coverUrl, href, isPlaying = false }) {
  const card    = document.getElementById(`mc-${id}`);
  const coverEl = document.getElementById(`mc-${id}-cover`);
  const titleEl = document.getElementById(`mc-${id}-title`);
  const linkEl  = document.getElementById(`mc-${id}-link`);

  if (!card) return;

  // State & dot
  card.dataset.state   = 'loaded';
  card.dataset.playing = String(isPlaying);

  // Title
  if (titleEl) titleEl.textContent = title || '—';

  // Link
  if (linkEl && href) linkEl.href = href;

  const phIcons = { music: '♫', film: 'Lb', series: 'Sz', game: 'Bg', comic: 'CG' };
  const phIcon  = phIcons[id] || '?';

  // Cover
  if (coverEl) {
    coverEl.innerHTML = '';
    if (coverUrl) {
      const img  = document.createElement('img');
      img.src    = coverUrl;
      img.alt    = '';
      img.loading = 'lazy';
      // On error fall back to placeholder icon
      img.onerror = () => {
        coverEl.innerHTML = '';
        const ph = document.createElement('span');
        ph.className = 'mc-ph-icon';
        ph.textContent = phIcon;
        coverEl.appendChild(ph);
      };
      coverEl.appendChild(img);
    } else {
      const ph = document.createElement('span');
      ph.className  = 'mc-ph-icon';
      ph.textContent = phIcon;
      coverEl.appendChild(ph);
    }
  }
}

// ─── Media Cards — Spotify via Last.FM ───────────────────────────────────────

async function fetchMusicCard() {
  const { lastfmUser, lastfmApiKey, fallbackUrl } = MEDIA.music;
  const params = new URLSearchParams({
    method:  'user.getrecenttracks',
    user:    lastfmUser,
    api_key: lastfmApiKey,
    format:  'json',
    limit:   '1',
  });

  const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
  if (!res.ok) throw new Error('Last.fm error');

  const data  = await res.json();
  const track = data?.recenttracks?.track;
  const t     = Array.isArray(track) ? track[0] : track;
  if (!t) return;

  const isPlaying = t['@attr']?.nowplaying === 'true';
  const images    = t?.image || [];
  const coverUrl  = [...images].reverse().find(i => i['#text'])?.['#text'] || '';

  setMediaCard('music', {
    title:     t.name || '—',
    coverUrl,
    href:      t.url  || fallbackUrl,
    isPlaying,
  });
}

// ─── Media Cards — Letterboxd via RSS→JSON ───────────────────────────────────

function extractImgSrc(html) {
  if (!html) return '';
  const m = html.match(/<img[^>]+src="([^"]+)"/i);
  return m?.[1] || '';
}

function cleanLetterboxdTitle(raw) {
  if (!raw) return '—';
  // "The Dark Knight, 2008 - ★★★★★" → "The Dark Knight"
  return raw.replace(/,\s*\d{4}.*$/, '').trim();
}

async function fetchFilmCard() {
  const { letterboxdUser, fallbackUrl } = MEDIA.film;
  const rssUrl = `https://letterboxd.com/${letterboxdUser}/rss/`;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=1`;

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error('RSS fetch error');

  const data = await res.json();
  if (data.status !== 'ok' || !data.items?.length) throw new Error('No Letterboxd items');

  const item     = data.items[0];
  const coverUrl = item.thumbnail || extractImgSrc(item.description || '');
  const title    = cleanLetterboxdTitle(item.title);

  setMediaCard('film', {
    title,
    coverUrl,
    href: item.link || fallbackUrl,
  });
}

// ─── Media Cards — Serializd via RSS→JSON ────────────────────────────────────

async function fetchSeriesCard() {
  const { serializdUser, fallbackUrl } = MEDIA.series;

  // Serializd exposes an RSS feed of recent activity
  const rssUrl = `https://www.serializd.com/rss/user/${serializdUser}`;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=1`;

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error('Serializd RSS fetch error');

  const data = await res.json();
  if (data.status !== 'ok' || !data.items?.length) throw new Error('No Serializd items');

  const item = data.items[0];

  // Title: strip episode info if present — "Show Name - S01E01" → "Show Name"
  const rawTitle = item.title || '—';
  const title = rawTitle.replace(/\s[-–]\s+S\d+E\d+.*$/i, '').trim() || rawTitle;

  // Poster: grab from thumbnail or first <img> in description
  const coverUrl = item.thumbnail || extractImgSrc(item.description || '');

  // Activate the card (remove inactive state)
  const card = document.getElementById('mc-series');
  if (card) {
    card.classList.remove('mc-inactive');
    const pendingEl = card.querySelector('.mc-pending');
    if (pendingEl) pendingEl.classList.remove('mc-pending');
  }

  setMediaCard('series', {
    title,
    coverUrl,
    href: item.link || fallbackUrl,
  });
}

// ─── Media Cards — Init ───────────────────────────────────────────────────────

function initMediaCards() {
  // Mark active cards as loading
  ['music', 'film', 'series'].forEach(id => {
    const card = document.getElementById(`mc-${id}`);
    if (card) card.dataset.state = 'loading';
  });

  const tryMusic  = () => fetchMusicCard().catch(() =>
    setMediaCard('music',  { title: 'spotify',    coverUrl: '', href: MEDIA.music.fallbackUrl })
  );
  const tryFilm   = () => fetchFilmCard().catch(() =>
    setMediaCard('film',   { title: 'letterboxd', coverUrl: '', href: MEDIA.film.fallbackUrl })
  );
  const trySeries = () => fetchSeriesCard().catch(() =>
    setMediaCard('series', { title: 'serializd',  coverUrl: '', href: MEDIA.series.fallbackUrl })
  );

  // Initial fetch
  tryMusic();
  tryFilm();
  trySeries();

  // Polling intervals
  setInterval(tryMusic,  MEDIA.music.refreshMs);
  setInterval(tryFilm,   MEDIA.film.refreshMs);
  setInterval(trySeries, MEDIA.series.refreshMs);

  // Refresh on tab visibility restore
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      tryMusic();
      tryFilm();
      trySeries();
    }
  });
}

// ─── Card 3D tilt interactions ────────────────────────────────────────────────

let pointerX = window.innerWidth  / 2;
let pointerY = window.innerHeight / 2;

function setPointerPosition(x, y) {
  pointerX = x;
  pointerY = y;
  root.style.setProperty('--mouse-x', `${x}px`);
  root.style.setProperty('--mouse-y', `${y}px`);
}

function bindCardInteractions() {
  document.querySelectorAll('.glass-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const px = x / rect.width  - 0.5;
      const py = y / rect.height - 0.5;

      card.style.setProperty('--card-x', `${x}px`);
      card.style.setProperty('--card-y', `${y}px`);

      if (!prefersReducedMotion && card.matches('a, article, .media-card')) {
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

// ─── Particle background ──────────────────────────────────────────────────────

let particles      = [];
let animationFrame = null;

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

document.addEventListener('pointermove', e => setPointerPosition(e.clientX, e.clientY), { passive: true });
document.addEventListener('pointerleave', () => setPointerPosition(window.innerWidth / 2, window.innerHeight / 2));

// ─── Boot ─────────────────────────────────────────────────────────────────────

updateClock();
setInterval(updateClock, 1000);
initMediaCards();
bindCardInteractions();
initBackground();

window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});
