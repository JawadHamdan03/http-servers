import express, { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";


// middlewares
function middlewareMetricsInc(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  apiConfig.fileserverHits++;
  next();
}


const middlewareLogResponses = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.on("finish", () => {
    const statusCode = res.statusCode;

    if (statusCode !== 200) {
      console.log(
        `[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`
      );
    }
  });

  next();
};


// handlers
const handlerReadiness = async (req: Request, res: Response): Promise<void> => {
  res
    .set("Content-Type", "text/plain; charset=utf-8")
    .send("OK");
};

const handlerAdminMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
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


const handlerReset = async (
  req: Request,
  res: Response
): Promise<void> => {
  apiConfig.fileserverHits = 0;

  res
    .set("Content-Type", "text/plain; charset=utf-8")
    .send("OK");
};


const handlerValidateChirp = async (req: Request, res: Response) => {
  const chirp = req.body?.body;

  if (!chirp || typeof chirp !== "string") {
    res.status(400).json({
      error: "Invalid chirp body",
    });
    return;
  }

  if (chirp.length > 140) {
    res.status(400).json({
      error: "Chirp is too long",
    });
    return;
  }

  res.status(200).json({
    valid: true,
  });
}



////////////////////////////////////////////
const app = express();
const PORT = 8080;

app.use("/app", middlewareMetricsInc);
app.use(express.json());
app.use(middlewareLogResponses);

app.use("/app", express.static("./src/app"));
app.get("/api/healthz", handlerReadiness);
app.get("/admin/metrics", handlerAdminMetrics);
app.post("/admin/reset", handlerReset);
app.post("/api/validate_chirp", handlerValidateChirp);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
