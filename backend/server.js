//entry point for the Express server
// This file sets up the server, handles routes, and integrates with the Deezer API client

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import trackRoutes from "./routes/trackRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.disable("x-powered-by");

// K-Pop endpoints
app.use("/api/tracks", trackRoutes);

// tiny error handler
app.use((err, _req, res, _next) => {
  const status = err?.response?.status || 502;
  const msg =
    err?.response?.data?.error?.message || err?.message || "Upstream error";
  res.status(status).json({ error: msg });
});

const port = process.env.PORT || 8080;
app.listen(port, () =>
  console.log(`Server running at http://localhost:${port}`)
);
