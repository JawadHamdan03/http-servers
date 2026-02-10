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
const handlerReadiness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res
      .set("Content-Type", "text/plain; charset=utf-8")
      .send("OK");
  }
  catch (err) {
    next(err);
  }

};

const handlerAdminMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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
  }
  catch (err) {
    next(err);
  }
}


const handlerReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  apiConfig.fileserverHits = 0;
  try {
    res
      .set("Content-Type", "text/plain; charset=utf-8")
      .send("OK");
  }
  catch (err) {
    next(err)
  }

};


const handlerValidateChirp = async (req: Request, res: Response) => {
  const chirp = req.body?.body;

  try {
    if (!chirp || typeof chirp !== "string") {
      res.status(400).json({
        error: "Invalid chirp body",
      });
      return;
    }

    if (chirp.length > 140) {
      throw new Error("Chirp is too long");
      res.status(400).json({
        error: "Chirp is too long",
      });
      return;
    }

    const profaneWords = ["kerfuffle", "sharbert", "fornax"];

    const words = chirp.split(" ");

    const cleanedWords = words.map((word) => {
      if (profaneWords.includes(word.toLowerCase())) {
        return "****";
      }
      return word;
    });

    const cleanedBody = cleanedWords.join(" ");

    res.status(200).json({
      cleanedBody: cleanedBody,
    });
  }

  catch (err) {

  }

}


const errorHandler = async (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`${err.message}`);
  res.status(500).json({ error: "Something went wrong on our end" });
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


app.use(errorHandler);


app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
