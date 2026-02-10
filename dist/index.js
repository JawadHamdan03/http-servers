import express from "express";
import { apiConfig } from "./config.js";
import { BadRequest, Unauthorized, Forbidden, NotFound, } from "./CustomErrors.js";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
/* ---------- RUN MIGRATIONS ON STARTUP ---------- */
const migrationClient = postgres(config.url, { max: 1 });
await migrate(drizzle(migrationClient), config.migrationConfig);
await migrationClient.end();
//   Middleware
const middlewareMetricsInc = (req, res, next) => {
    apiConfig.fileserverHits++;
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
   Handlers
===================== */
const handlerReadiness = (req, res) => {
    res.set("Content-Type", "text/plain; charset=utf-8").send("OK");
};
const handlerAdminMetrics = (req, res) => {
    res
        .set("Content-Type", "text/html; charset=utf-8")
        .send(`
<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${apiConfig.fileserverHits} times!</p>
  </body>
</html>
`);
};
const handlerReset = (req, res) => {
    apiConfig.fileserverHits = 0;
    res.set("Content-Type", "text/plain; charset=utf-8").send("OK");
};
const handlerValidateChirp = (req, res, next) => {
    try {
        const chirp = req.body?.body;
        if (!chirp || typeof chirp !== "string") {
            throw new BadRequest("Invalid chirp body");
        }
        if (chirp.length > 140) {
            throw new BadRequest("Chirp is too long. Max length is 140");
        }
        const profaneWords = ["kerfuffle", "sharbert", "fornax"];
        const cleanedBody = chirp
            .split(" ")
            .map((word) => profaneWords.includes(word.toLowerCase()) ? "****" : word)
            .join(" ");
        res.status(200).json({ cleanedBody });
    }
    catch (err) {
        next(err);
    }
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
app.get("/admin/reset", handlerReset);
app.post("/api/validate_chirp", handlerValidateChirp);
app.use(errorHandler);
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
