import { deezerGet } from "./client.js";
import { getCache, setCache, isExpired } from "../utils/cache.js";
import { shuffleInPlace } from "../utils/shuffle.js";

export const GENRES = Object.freeze(["kpop", "pop", "hiphop", "karaoke hits", "top hits", "r&b"]);

// Map each genre to a Deezer playlist ID
const PLAYLIST_BY_GENRE = {
  kpop: 12244134951, 
  pop:  13650203641,  
  hiphop: 1677006641,   
  "karaoke hits":  7280809544,  
  "top hits": 3155776842,
  "r&b": 1999466402,
};

// Check if a genre is valid
function isValidGenre(genre) {
  return GENRES.includes(String(genre).toLowerCase());
}

//Normalizes a Deezer track object to a standard format.
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

// Fetch tracks from a Deezer playlist with pagination support
async function fetchPlaylist(playlistId, index = 0, limit = 50) {
  const data = await deezerGet(`/playlist/${playlistId}/tracks`, {
    params: { index, limit },
  });
  const items = data?.data ?? [];
  return items.map(normalizeTrack);
}

// Remove duplicate tracks based on ID and name/artist combination
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
  // Fetch first 150 tracks (3 pages of 50)
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

// Get random tracks by genre, using cache if available
export async function getRandomByGenre(genre = "kpop", count = 50) {
  const key = cacheKeyFor(genre);
  const entry = getCache(key);
  let pool = entry?.items;

  // If no cache or expired, rebuild the pool
  if (!pool || isExpired(entry)) {
    pool = await buildPoolForGenre(genre);
    setCache(key, pool);
  }
  return pool.slice(0, count);
}

// Force refresh the pool for a genre and update cache
export async function refreshGenre(genre = "kpop") {
  const key = cacheKeyFor(genre);
  const fresh = await buildPoolForGenre(genre);
  setCache(key, fresh, true);
  return fresh.length;
}
