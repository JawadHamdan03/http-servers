import argon2 from "argon2";
import jwt, { type JwtPayload } from "jsonwebtoken";

export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
}

export async function checkPasswordHash(
    password: string,
    hash: string
): Promise<boolean> {
    return argon2.verify(hash, password);
}

type JWTPayload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(
    userID: string,
    expiresIn: number,
    secret: string
): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
        iss: "chirpy",
        sub: userID,
        iat: issuedAt,
        exp: issuedAt + expiresIn,
    };

    return jwt.sign(payload, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
    try {
        const decoded = jwt.verify(tokenString, secret);
        if (typeof decoded === "string" || !decoded.sub) {
            throw new Error("Invalid token");
        }

        return decoded.sub;
    } catch (error) {
        throw new Error("Invalid or expired token");
    }
}
