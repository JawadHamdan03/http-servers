import express from "express";
import { config } from "./config.js";
import { BadRequest, Forbidden, NotFound, Unauthorized } from "./CustomErrors.js";
import { handlerAdminMetrics, handlerCreateChirp, handlerCreateUser, handlerDeleteChirp, handlerGetChirpById, handlerGetChirps, handlerLogin, handlerPolkaWebhook, handlerReadiness, handlerRefresh, handlerReset, handlerRevoke, handlerUpdateUser, } from "./handlers.js";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
/* ---------- RUN MIGRATIONS ON STARTUP ---------- */
const migrationClient = postgres(config.url, { max: 1 });
await migrate(drizzle(migrationClient), config.migrationConfig);
await migrationClient.end();
//   Middleware
const middlewareMetricsInc = (req, res, next) => {
    config.fileserverHits++;
    next();
};
const middlewareLogResponses = (req, res, next) => {
    res.on("finish", () => {
        if (res.statusCode !== 200) {
            console.log(`[NON-OK] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
        }
    });
    next();
};
/* =====================
   Error Handler
===================== */
const errorHandler = (err, req, res, next) => {
    if (err instanceof BadRequest) {
        res.status(400).json({ error: err.message });
        return;
    }
    if (err instanceof Unauthorized) {
        res.status(401).json({ error: err.message });
        return;
    }
    if (err instanceof Forbidden) {
        res.status(403).json({ error: err.message });
        return;
    }
    if (err instanceof NotFound) {
        res.status(404).json({ error: err.message });
        return;
    }
    // Non-custom errors
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
};
/* =====================
   App Setup
===================== */
const app = express();
const PORT = 8080;
app.use(express.json());
app.use(middlewareLogResponses);
app.use("/app", middlewareMetricsInc);
app.use("/app", express.static("./src/app"));
app.get("/api/healthz", handlerReadiness);
app.get("/admin/metrics", handlerAdminMetrics);
app.get("/api/chirps", handlerGetChirps);
app.get("/api/chirps/:chirpId", handlerGetChirpById);
app.post("/admin/reset", handlerReset);
app.post("/api/users", handlerCreateUser);
app.post("/api/login", handlerLogin);
app.post("/api/chirps", handlerCreateChirp);
app.post("/api/refresh", handlerRefresh);
app.post("/api/revoke", handlerRevoke);
app.put("/api/users", handlerUpdateUser);
app.delete("/api/chirps/:chirpId", handlerDeleteChirp);
app.post("/api/polka/webhooks", handlerPolkaWebhook);
app.use(errorHandler);
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
