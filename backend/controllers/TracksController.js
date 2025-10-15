import { GENRES, getRandomByGenre, refreshGenre } from "../deezer/music.js";

function toGenre(q) {
  return String(q || "kpop").toLowerCase();
}

function toCount(q) {
  const n = Number.parseInt(String(q ?? "50"), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 50;
}

export default class TracksController {
  /**
   * Handles the request to retrieve a random set of tracks by genre.
   *
   * @param {import('express').Request} req - Express request object, expects 'genre' and 'count' as query parameters.
   * @param {import('express').Response} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>} Responds with a JSON object containing the genre, count, and array of tracks.
   */
  static async getRandomTracks(req, res, next) {
    try {
      const genre = toGenre(req.query.genre);
      const count = toCount(req.query.count);

      if (!GENRES.includes(genre)) {
        return res
          .status(400)
          .json({ error: "Unsupported genre", allowed: GENRES });
      }

      const tracks = await getRandomByGenre(genre, count);
      res.json({ genre, count: tracks.length, tracks });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Refreshes the tracks for a specified genre.
   * Validates the genre from the query parameters and refreshes the tracks if supported.
   * Responds with the refreshed tracks and genre information.
   *
   * @param {import('express').Request} req - Express request object, expects 'genre' in query parameters.
   * @param {import('express').Response} res - Express response object.
   * @param {Function} next - Express next middleware function.
   * @returns {Promise<void>}
   */
  static async refreshTracks(req, res, next) {
    try {
      const genre = toGenre(req.query.genre);

      if (!GENRES.includes(genre)) {
        return res
          .status(400)
          .json({ error: "Unsupported genre", allowed: GENRES });
      }

      const refreshed = await refreshGenre(genre);
      res.json({ genre, refreshed });
    } catch (err) {
      next(err);
    }
  }
}
