const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const canvas = document.getElementById('bg-canvas');
const ctx = canvas?.getContext('2d');

const MEDIA_CONFIG = {
  spotify: {
    api: 'https://lastfm-last-played.biancarosa.com.br/Wilford_Studios/latest-song'
  },
  letterboxd: {
    rss: 'https://letterboxd.com/Wilford_Studios/rss/'
  },
  serializd: {
    rss: 'https://www.serializd.com/rss/Wilford_Studios'
  },
  backloggd: {
    rss: 'https://www.backloggd.com/u/Wilford_Studios/rss/'
  },
  comics: {
    rss: 'https://leagueofcomicgeeks.com/profile/Wilford_Studios/rss'
  }
};

let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let particles = [];
let animationFrame = null;
let nowPlayingInterval = null;

function switchTab(tab, el) {
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });

  document.querySelectorAll('.pill').forEach(pill => {
    pill.classList.remove('active');
  });

  const target = document.getElementById(`tab-${tab}`);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
}

function updateClock() {
  const time = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  const clock = document.getElementById('clock');
  if (clock) clock.textContent = time;
}

async function fetchRSS(url) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const response = await fetch(api);
  return response.json();
}

function extractImage(html) {
  if (!html) return '';
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : '';
}

function setMediaCard(prefix, data) {
  const title = document.getElementById(`${prefix}-title`);
  const subtitle = document.getElementById(`${prefix}-subtitle`);
  const image = document.getElementById(`${prefix}-image`);

  if (!title || !subtitle || !image) return;

  title.textContent = data.title || 'Sin datos';
  subtitle.textContent = data.subtitle || '';
  image.src = data.image || 'assets/profile-durin.jpg';
}

async function fetchSpotify() {
  try {
    const response = await fetch(MEDIA_CONFIG.spotify.api);
    const data = await response.json();

    setMediaCard('spotify', {
      title: data.track?.name || 'Sin reproducción',
      subtitle: data.track?.artist['#text'] || 'Spotify',
      image: data.track?.image?.['#text'] || ''
    });
  } catch (error) {
    console.error(error);
  }
}

async function fetchLetterboxd() {
  try {
    const data = await fetchRSS(MEDIA_CONFIG.letterboxd.rss);
    const item = data.items?.[0];
    if (!item) return;

    setMediaCard('letterboxd', {
      title: item.title,
      subtitle: 'Letterboxd',
      image: extractImage(item.description)
    });
  } catch (error) {
    console.error(error);
  }
}

async function fetchSerializd() {
  try {
    const data = await fetchRSS(MEDIA_CONFIG.serializd.rss);
    const item = data.items?.[0];
    if (!item) return;

    setMediaCard('serializd', {
      title: item.title,
      subtitle: 'Serializd',
      image: extractImage(item.description)
    });
  } catch (error) {
    console.error(error);
  }
}

async function fetchBackloggd() {
  try {
    const data = await fetchRSS(MEDIA_CONFIG.backloggd.rss);
    const item = data.items?.[0];
    if (!item) return;

    setMediaCard('backloggd', {
      title: item.title,
      subtitle: 'Backloggd',
      image: extractImage(item.description)
    });
  } catch (error) {
    console.error(error);
  }
}

async function fetchComics() {
  try {
    const data = await fetchRSS(MEDIA_CONFIG.comics.rss);
    const item = data.items?.[0];
    if (!item) return;

    setMediaCard('comic', {
      title: item.title,
      subtitle: 'League of Comic Geeks',
      image: extractImage(item.description)
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadMediaCards() {
  await Promise.all([
    fetchSpotify(),
    fetchLetterboxd(),
    fetchSerializd(),
    fetchBackloggd(),
    fetchComics()
  ]);
}

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
      const px = x / rect.width - 0.5;
      const py = y / rect.height - 0.5;

      card.style.setProperty('--card-x', `${x}px`);
      card.style.setProperty('--card-y', `${y}px`);

      if (!prefersReducedMotion && card.matches('a, article, .now-playing')) {
        card.style.transform = `translateY(-2px) rotateX(${-py * 2.8}deg) rotateY(${px * 3.2}deg)`;
      }
    });

    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
      card.style.removeProperty('--card-x');
      card.style.removeProperty('--card-y');
    });
  });
}

function resizeCanvas() {
  if (!canvas || !ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(90, Math.max(42, Math.floor(window.innerWidth / 16)));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: Math.random() * 1.5 + 0.35,
    vx: (Math.random() - 0.5) * 0.14,
    vy: (Math.random() - 0.5) * 0.14,
    alpha: Math.random() * 0.36 + 0.1,
  }));
}

function drawBackground() {
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach(particle => {
    const dx = pointerX - particle.x;
    const dy = pointerY - particle.y;
    const distance = Math.hypot(dx, dy);
    const pull = Math.max(0, 1 - distance / 460) * 0.014;

    particle.x += particle.vx + dx * pull;
    particle.y += particle.vy + dy * pull;

    if (particle.x < -10) particle.x = window.innerWidth + 10;
    if (particle.x > window.innerWidth + 10) particle.x = -10;
    if (particle.y < -10) particle.y = window.innerHeight + 10;
    if (particle.y > window.innerHeight + 10) particle.y = -10;

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(188, 218, 230, ${particle.alpha})`;
    ctx.fill();
  });

  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const a = particles[i];
      const b = particles[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);

      if (distance < 110) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(184, 216, 229, ${(1 - distance / 110) * 0.09})`;
        ctx.lineWidth = 1;
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

document.addEventListener('pointermove', event => {
  setPointerPosition(event.clientX, event.clientY);
}, { passive: true });

document.addEventListener('pointerleave', () => {
  setPointerPosition(window.innerWidth / 2, window.innerHeight / 2);
});

updateClock();
setInterval(updateClock, 1000);
loadMediaCards();
bindCardInteractions();
initBackground();

window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (nowPlayingInterval) clearInterval(nowPlayingInterval);
});
