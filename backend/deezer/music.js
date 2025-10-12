import { deezerGet } from "./client.js";
import { getCache, setCache, isExpired } from "../utils/cache.js";
import { shuffleInPlace } from "../utils/shuffle.js";

export const GENRES = Object.freeze(["kpop", "pop", "hiphop", "edm"]);

// Map each genre to a Deezer playlist ID
const PLAYLIST_BY_GENRE = {
  kpop: 4096400722, 
  pop:  2098157264,  
  hiphop: 1677006641,   
  edm:  7280809544,  
};

function isValidGenre(genre) {
  return GENRES.includes(String(genre).toLowerCase());
}


function normalizeTrack(t) {
  return {
    id: t.id,
    name: t.title,
    artists: t.artist?.name ? [t.artist.name] : [],
    preview_url: t.preview || null,
    duration_ms: (t.duration ?? 0) * 1000,
    image: t.album?.cover_medium || null,
    external_url: t.link || null,
    is_playable: true,
  };
}

async function fetchPlaylist(playlistId, index = 0, limit = 50) {
  const data = await deezerGet(`/playlist/${playlistId}/tracks`, {
    params: { index, limit },
  });
  const items = data?.data ?? [];
  return items.map(normalizeTrack);
}

function dedupe(tracks) {
  const seenId = new Set();
  const seenKey = new Set();
  const out = [];
  for (const t of tracks) {
    const idKey = String(t.id);
    const nameKey = `${(t.name || "").toLowerCase()}::${(t.artists?.[0] || "").toLowerCase()}`;
    if (seenId.has(idKey) || seenKey.has(nameKey)) continue;
    seenId.add(idKey);
    seenKey.add(nameKey);
    out.push(t);
  }
  return out;
}

// Build/refresh a pool for a specific genre
async function buildPoolForGenre(genre) {
  const key = String(genre).toLowerCase();
  if (!isValidGenre(key)) {
    throw new Error(`Unsupported genre: ${genre}. Allowed: ${GENRES.join(", ")}`);
  }

  const playlistId = PLAYLIST_BY_GENRE[key];
  let pool = [];
  for (const idx of [0, 50, 100]) {
    const chunk = await fetchPlaylist(playlistId, idx, 50);
    pool.push(...chunk);
  }
  pool = dedupe(pool.filter((t) => t.preview_url));
  shuffleInPlace(pool);
  return pool;
}

// Cache key per genre
function cacheKeyFor(genre) {
  return `chart_pool:${String(genre).toLowerCase()}`;
}

export async function getRandomByGenre(genre = "kpop", count = 50) {
  const key = cacheKeyFor(genre);
  const entry = getCache(key);
  let pool = entry?.items;

  if (!pool || isExpired(entry)) {
    pool = await buildPoolForGenre(genre);
    setCache(key, pool);
  }

  const shuffledPool = [...pool];
  shuffleInPlace(shuffledPool);
  
  return pool.slice(0, count);
}

export async function refreshGenre(genre = "kpop") {
  const key = cacheKeyFor(genre);
  const fresh = await buildPoolForGenre(genre);
  setCache(key, fresh, true);
  return fresh.length;
}
