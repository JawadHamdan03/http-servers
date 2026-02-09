import express from "express";
import { apiConfig } from "./config.js";
// middlewares
function middlewareMetricsInc(req, res, next) {
    apiConfig.fileserverHits++;
    next();
}
const middlewareLogResponses = (req, res, next) => {
    res.on("finish", () => {
        const statusCode = res.statusCode;
        if (statusCode !== 200) {
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`);
        }
    });
    next();
};
// handlers
const handlerReadiness = async (req, res) => {
    res
        .set("Content-Type", "text/plain; charset=utf-8")
        .send("OK");
};
const handlerAdminMetrics = async (req, res) => {
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
const handlerReset = async (req, res) => {
    apiConfig.fileserverHits = 0;
    res
        .set("Content-Type", "text/plain; charset=utf-8")
        .send("OK");
};
////////////////////////////////////////////
const app = express();
const PORT = 8080;
app.use("/app", middlewareMetricsInc);
app.use(middlewareLogResponses);
app.use("/app", express.static("./src/app"));
app.get("/api/healthz", handlerReadiness);
app.get("/admin/metrics", handlerAdminMetrics);
app.get("/admin/reset", handlerReset);
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
