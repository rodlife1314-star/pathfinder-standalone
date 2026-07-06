import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import routes from "./routes";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const app = express();
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true, service: "pathfinder", version: "0.1.0" });
});

app.use("/api", routes);

// In production, serve the built web UI.
if (process.env.NODE_ENV === "production") {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(dir, "../../web/dist");
  app.use(express.static(dist));
  app.get("*splat", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "pathfinder server listening");
});
