const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const canvas = document.getElementById('bg-canvas');
const ctx = canvas?.getContext('2d');

const NOW_PLAYING_CONFIG = {
  provider: 'lastfm',
  lastfmUser: 'Wilford_Studios',
  lastfmApiKey: 'f13d8b297568b04f7cfa22684044b6bd',
  customEndpoint: '',
  refreshMs: 15000,
  fallback: {
    title: 'spotify · mi perfil',
    artist: '',
    url: 'https://open.spotify.com/user/r94decpncosw8hogydivy5ma3',
  },
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

function getLastfmImage(track) {
  const images = track?.image || [];
  const image = [...images].reverse().find(item => item['#text']);
  return image?.['#text'] || '';
}

function normalizeLastfmTrack(track) {
  if (!track) return null;

  const isPlaying = track['@attr']?.nowplaying === 'true';
  return {
    title: track.name || NOW_PLAYING_CONFIG.fallback.title,
    artist: track.artist?.['#text'] || 'spotify',
    album: track.album?.['#text'] || '',
    albumArt: getLastfmImage(track),
    url: track.url || NOW_PLAYING_CONFIG.fallback.url,
    isPlaying,
  };
}

function normalizeEndpointTrack(data) {
  if (!data) return null;

  return {
    title: data.title || data.name || NOW_PLAYING_CONFIG.fallback.title,
    artist: data.artist || data.artists || NOW_PLAYING_CONFIG.fallback.artist,
    album: data.album || '',
    albumArt: data.albumArt || data.image || data.cover || '',
    url: data.url || data.songUrl || NOW_PLAYING_CONFIG.fallback.url,
    isPlaying: Boolean(data.isPlaying ?? data.playing),
  };
}

async function fetchLastfmNowPlaying() {
  const { lastfmUser, lastfmApiKey } = NOW_PLAYING_CONFIG;
  if (!lastfmUser || !lastfmApiKey) return null;

  const params = new URLSearchParams({
    method: 'user.getrecenttracks',
    user: lastfmUser,
    api_key: lastfmApiKey,
    format: 'json',
    limit: '1',
  });

  const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
  if (!response.ok) throw new Error('No se pudo leer Last.fm');

  const data = await response.json();
  const track = data?.recenttracks?.track;
  return normalizeLastfmTrack(Array.isArray(track) ? track[0] : track);
}

async function fetchEndpointNowPlaying() {
  if (!NOW_PLAYING_CONFIG.customEndpoint) return null;

  const response = await fetch(NOW_PLAYING_CONFIG.customEndpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo leer el endpoint de now playing');
  return normalizeEndpointTrack(await response.json());
}

function setCover(coverEl, albumArt) {
  coverEl.textContent = '';

  if (!albumArt) {
    coverEl.textContent = '♫';
    coverEl.classList.remove('has-cover');
    return;
  }

  const image = document.createElement('img');
  image.src = albumArt;
  image.alt = '';
  image.loading = 'lazy';
  coverEl.appendChild(image);
  coverEl.classList.add('has-cover');
}

function updateNowPlayingWidget(track, status = 'config') {
  const widget = document.querySelector('.now-playing');
  const label = document.querySelector('.np-label');
  const trackEl = document.querySelector('.np-track');
  const artistEl = document.getElementById('np-artist');
  const coverEl = document.getElementById('np-cover');
  const coverLink = document.querySelector('.np-cover-link');

  if (!widget || !label || !trackEl || !artistEl || !coverEl) return;

  const safeTrack = track || NOW_PLAYING_CONFIG.fallback;
  const isPlaying = Boolean(safeTrack.isPlaying);

  widget.dataset.state = isPlaying ? 'playing' : status;
  label.innerHTML = `<span class="np-dot" aria-hidden="true"></span>${isPlaying ? 'escuchando ahora' : status === 'recent' ? 'último scrobble' : 'spotify status'}`;
  trackEl.textContent = safeTrack.title || NOW_PLAYING_CONFIG.fallback.title;
  artistEl.textContent = safeTrack.artist || NOW_PLAYING_CONFIG.fallback.artist;

  if ('href' in trackEl) trackEl.href = safeTrack.url || NOW_PLAYING_CONFIG.fallback.url;
  if (coverLink) coverLink.href = safeTrack.url || NOW_PLAYING_CONFIG.fallback.url;

  setCover(coverEl, safeTrack.albumArt);
}

async function refreshNowPlaying() {
  try {
    const track = NOW_PLAYING_CONFIG.customEndpoint
      ? await fetchEndpointNowPlaying()
      : await fetchLastfmNowPlaying();

    if (!track) {
      updateNowPlayingWidget(NOW_PLAYING_CONFIG.fallback, 'config');
      return;
    }

    updateNowPlayingWidget(track, track.isPlaying ? 'playing' : 'recent');
  } catch (error) {
    updateNowPlayingWidget({
      ...NOW_PLAYING_CONFIG.fallback,
      artist: 'no pude leer el tracking ahora',
    }, 'error');
  }
}

function startNowPlayingInterval() {
  if (nowPlayingInterval) clearInterval(nowPlayingInterval);
  nowPlayingInterval = setInterval(refreshNowPlaying, NOW_PLAYING_CONFIG.refreshMs);
}

function initNowPlayingTracking() {
  updateNowPlayingWidget(NOW_PLAYING_CONFIG.fallback, 'config');

  if (!NOW_PLAYING_CONFIG.customEndpoint && (!NOW_PLAYING_CONFIG.lastfmUser || !NOW_PLAYING_CONFIG.lastfmApiKey)) {
    return;
  }

  refreshNowPlaying();
  startNowPlayingInterval();

  // Refresh immediately when the tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshNowPlaying();
      startNowPlayingInterval();
    } else {
      if (nowPlayingInterval) clearInterval(nowPlayingInterval);
    }
  });
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

function openPostModal(postId) {
  const postCard = document.querySelector(`[data-post-id="${postId}"]`);
  if (!postCard) return;

  const modal = document.getElementById('post-modal');
  const modalDate = document.getElementById('modal-date');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');

  const date = postCard.querySelector('.post-date').textContent;
  const title = postCard.querySelector('.post-title').textContent;
  const content = postCard.querySelector('.post-content').innerHTML;

  modalDate.textContent = date;
  modalTitle.textContent = title;
  modalBody.innerHTML = content;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePostModal() {
  const modal = document.getElementById('post-modal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

function initPostCards() {
  document.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => {
      const postId = card.getAttribute('data-post-id');
      if (postId) {
        openPostModal(postId);
      }
    });
  });

  const modal = document.getElementById('post-modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePostModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePostModal();
    }
  });
}

updateClock();
setInterval(updateClock, 1000);
initNowPlayingTracking();
bindCardInteractions();
initBackground();
initPostCards();

window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (nowPlayingInterval) clearInterval(nowPlayingInterval);
});
