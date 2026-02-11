import express, { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import {
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
} from "./CustomErrors.js";
import {
  checkPasswordHash,
  getBearerToken,
  hashPassword,
  makeJWT,
  makeRefreshToken,
  validateJWT,
} from "./auth.js";
import { createUser, deleteAllUsers, getUserByEmail } from "./db/queries/users.js";
import { createChirp, getChirpById, getChirps } from "./db/queries/chirps.js";
import {
  createRefreshToken,
  getRefreshToken,
  getUserFromRefreshToken,
  revokeRefreshToken,
} from "./db/queries/refreshTokens.js";
import type { User } from "./db/schema.js";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";


/* ---------- RUN MIGRATIONS ON STARTUP ---------- */
const migrationClient = postgres(config.url, { max: 1 });
await migrate(drizzle(migrationClient), config.migrationConfig);
await migrationClient.end();




//   Middleware
const middlewareMetricsInc = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  config.fileserverHits++;
  next();
};

const middlewareLogResponses = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.on("finish", () => {
    if (res.statusCode !== 200) {
      console.log(
        `[NON-OK] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`
      );
    }
  });
  next();
};

/* =====================
   Handlers
===================== */

type UserResponse = Omit<User, "hashedPassword">;

const handlerReadiness = (
  req: Request,
  res: Response
): void => {
  res.set("Content-Type", "text/plain; charset=utf-8").send("OK");
};

const handlerAdminMetrics = (
  req: Request,
  res: Response
): void => {
  res
    .set("Content-Type", "text/html; charset=utf-8")
    .send(`
<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.fileserverHits} times!</p>
  </body>
</html>
`);
};

const handlerReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (config.platform !== "dev") {
      throw new Forbidden("Reset is only allowed in dev");
    }

    config.fileserverHits = 0;
    await deleteAllUsers();
    res.set("Content-Type", "text/plain; charset=utf-8").send("OK");
  } catch (err) {
    next(err);
  }
};

const handlerCreateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const email = req.body?.email;
    const password = req.body?.password;

    if (!email || typeof email !== "string") {
      throw new BadRequest("Invalid email");
    }

    if (!password || typeof password !== "string") {
      throw new BadRequest("Invalid password");
    }

    const hashedPassword = await hashPassword(password);

    const user = await createUser({ email, hashedPassword });

    if (!user) {
      throw new BadRequest("User already exists");
    }

    const { hashedPassword: _ignored, ...userResponse } = user;
    res.status(201).json(userResponse as UserResponse);
  } catch (err) {
    next(err);
  }
};

const handlerLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const email = req.body?.email;
    const password = req.body?.password;

    if (!email || typeof email !== "string") {
      throw new Unauthorized("incorrect email or password");
    }

    if (!password || typeof password !== "string") {
      throw new Unauthorized("incorrect email or password");
    }

    const user = await getUserByEmail(email);
    if (!user) {
      throw new Unauthorized("incorrect email or password");
    }

    const isValid = await checkPasswordHash(password, user.hashedPassword);
    if (!isValid) {
      throw new Unauthorized("incorrect email or password");
    }

    const token = makeJWT(user.id, 60 * 60, config.jwtSecret);
    const refreshToken = makeRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await createRefreshToken({
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshTokenExpiresAt,
      revokedAt: null,
    });
    const { hashedPassword: _ignored, ...userResponse } = user;
    res
      .status(200)
      .json({ ...userResponse, token, refreshToken } as UserResponse & {
        token: string;
        refreshToken: string;
      });
  } catch (err) {
    next(err as Error);
  }
};

const handlerCreateChirp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let userId: string;
    try {
      const token = getBearerToken(req);
      userId = validateJWT(token, config.jwtSecret);
    } catch (error) {
      throw new Unauthorized("Invalid or expired token");
    }

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
      .map((word) =>
        profaneWords.includes(word.toLowerCase()) ? "****" : word
      )
      .join(" ");

    const created = await createChirp({ body: cleanedBody, userId });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

const handlerRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let tokenString: string;
    try {
      tokenString = getBearerToken(req);
    } catch (error) {
      throw new Unauthorized("Invalid or expired token");
    }

    const result = await getUserFromRefreshToken(tokenString);
    if (!result) {
      throw new Unauthorized("Invalid or expired token");
    }

    const { user, refreshToken } = result;
    if (refreshToken.revokedAt) {
      throw new Unauthorized("Invalid or expired token");
    }

    if (refreshToken.expiresAt <= new Date()) {
      throw new Unauthorized("Invalid or expired token");
    }

    const token = makeJWT(user.id, 60 * 60, config.jwtSecret);
    res.status(200).json({ token });
  } catch (err) {
    next(err as Error);
  }
};

const handlerRevoke = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let tokenString: string;
    try {
      tokenString = getBearerToken(req);
    } catch (error) {
      throw new Unauthorized("Invalid or expired token");
    }

    const existing = await getRefreshToken(tokenString);
    if (!existing) {
      throw new Unauthorized("Invalid or expired token");
    }

    await revokeRefreshToken(tokenString, new Date());
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
};

const handlerGetChirps = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chirps = await getChirps();
    res.status(200).json(chirps);
  } catch (err) {
    next(err);
  }
};

const handlerGetChirpById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const chirpId = req.params.chirpId;

    if (!chirpId || Array.isArray(chirpId)) {
      throw new BadRequest("Invalid chirp id");
    }

    const chirp = await getChirpById(chirpId);

    if (!chirp) {
      throw new NotFound("Chirp not found");
    }

    res.status(200).json(chirp);
  } catch (err) {
    next(err);
  }
};

/* =====================
   Error Handler
===================== */

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

