import express from "express";
import { GENRES, getRandomByGenre, refreshGenre } from "../deezer/music.js";

const router = express.Router();


function toGenre(q) {
  return String(q || "kpop").toLowerCase();
}

function toCount(q) {
  const n = Number.parseInt(q, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 50;
}


router.get('/', async (req, res) => {
  try {
    const genre = toGenre(req.query.genre);
    const count = toCount(req.query.count);

    if (!GENRES.includes(genre)) {
      return res.status(400).json({ error: "Unsupported genre", allowed: GENRES });
    }

    const tracks = await getRandomByGenre(genre, count);
    res.json({ genre, tracks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch tracks" });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const genre = toGenre(req.query.genre);

    if (!GENRES.includes(genre)) {
      return res.status(400).json({ error: "Unsupported genre", allowed: GENRES });
    }

    const refreshed = await refreshGenre(genre);
    res.json({ genre, refreshed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to refresh" });
  }
});

export default router;