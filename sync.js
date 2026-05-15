// sync.js — corre en el servidor/CI, no en el navegador
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const LASTFM_API_KEY  = process.env.LASTFM_API_KEY;
const LASTFM_USER     = process.env.LASTFM_USER;

async function sync() {
  // 1. Pedir última canción a Last.fm
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks`
            + `&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;

  const res  = await fetch(url);
  const data = await res.json();
  const track = data?.recenttracks?.track;
  const t     = Array.isArray(track) ? track[0] : track;
  if (!t) { console.log('Sin pistas'); return; }

  const isPlaying = t['@attr']?.nowplaying === 'true';
  const coverUrl  = [...(t.image || [])].reverse().find(i => i['#text'])?.['#text'] || '';

  const payload = {
    title:     t.name || '—',
    artist:    t.artist?.['#text'] || '',
    coverUrl,
    href:      t.url || '',
    isPlaying,
    updatedAt: new Date().toISOString(),
  };

  // 2. Guardar en Firebase
  const fbRes = await fetch(`${FIREBASE_DB_URL}/lastTrack.json`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  console.log(`✓ Guardado: ${payload.artist} - ${payload.title} (playing: ${isPlaying})`);
}

sync().catch(err => { console.error(err); process.exit(1); });