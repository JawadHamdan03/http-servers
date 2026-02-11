import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import {
    BadRequest,
    Forbidden,
    NotFound,
    Unauthorized,
} from "./CustomErrors.js";
import {
    checkPasswordHash,
    getBearerToken,
    hashPassword,
    makeJWT,
    makeRefreshToken,
    validateJWT,
} from "./auth.js";
import {
    createRefreshToken,
    getRefreshToken,
    getUserFromRefreshToken,
    revokeRefreshToken,
} from "./db/queries/refreshTokens.js";
import { createChirp, getChirpById, getChirps } from "./db/queries/chirps.js";
import { createUser, deleteAllUsers, getUserByEmail } from "./db/queries/users.js";
import type { User } from "./db/schema.js";

type UserResponse = Omit<User, "hashedPassword">;

export const handlerReadiness = (req: Request, res: Response): void => {
    res.set("Content-Type", "text/plain; charset=utf-8").send("OK");
};

export const handlerAdminMetrics = (req: Request, res: Response): void => {
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

export const handlerReset = async (
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

export const handlerCreateUser = async (
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

export const handlerLogin = async (
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
        const refreshTokenExpiresAt = new Date(
            Date.now() + 60 * 24 * 60 * 60 * 1000
        );
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

export const handlerCreateChirp = async (
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

export const handlerRefresh = async (
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

export const handlerRevoke = async (
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

export const handlerGetChirps = async (
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

export const handlerGetChirpById = async (
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
