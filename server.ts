/**
 * Development/static frontend server.
 * AI generation is exclusively served by the authenticated Supabase gateway.
 * The legacy public prompt implementations were disclosed in Git history;
 * removing them here does not retroactively make them private.
 */
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(express.json({ limit: "64kb" }));

// Never accept a provider key or prompt from clients. Do not fall back to the
// old unprotected Gemini/OpenAI-compatible prompt route.
app.post("/api/generate-chunks", (_req, res) => {
  res.status(503).json({
    success: false,
    error: {
      code: "CONFIGURATION_ERROR",
      message: "Configure the authenticated server-only Supabase Edge AI gateway.",
      retryable: false
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  const pfxPath = process.env.HTTPS_PFX_PATH;
  const server = pfxPath
    ? https.createServer({
        pfx: fs.readFileSync(pfxPath),
        passphrase: process.env.HTTPS_PFX_PASSPHRASE || ""
      }, app)
    : http.createServer(app);
  server.listen(PORT, "0.0.0.0", () => {
    console.log("ChunkDiary development server listening at port " + PORT);
  });
}
startServer();
