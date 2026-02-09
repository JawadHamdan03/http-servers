import express, { Request, Response,  NextFunction } from "express";


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



const handlerReadiness = async (req: Request, res: Response): Promise<void> => {
  res
    .set("Content-Type", "text/plain; charset=utf-8")
    .send("OK");
};


const app = express();
const PORT = 8080;


app.use(middlewareLogResponses);

app.use("/app",express.static("./src/app"));
app.get("/healthz", handlerReadiness);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
