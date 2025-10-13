import { GENRES, getRandomByGenre, refreshGenre } from "../deezer/music.js";
function toGenre(q) {
  return String(q || "kpop").toLowerCase();
}
function toCount(q) {
  const n = Number.parseInt(String(q ?? "50"), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 50;
}

export default class TracksController {
  static async getRandomTracks(req, res, next) {
    try {
      const genre = toGenre(req.query.genre);
      const count = toCount(req.query.count);

      if (!GENRES.includes(genre)) {
        return res.status(400).json({ error: "Unsupported genre", allowed: GENRES });
      }

      const tracks = await getRandomByGenre(genre, count);
      res.json({ genre, count: tracks.length, tracks });
    } catch (err) {
      next(err);
    }
  }

  static async refreshTracks(req, res, next) {
    try {
      const genre = toGenre(req.query.genre);

      if (!GENRES.includes(genre)) {
        return res.status(400).json({ error: "Unsupported genre", allowed: GENRES });
      }

      const refreshed = await refreshGenre(genre);
      res.json({ genre, refreshed });
    } catch (err) {
      next(err);
    }
  }
  
}
