import argon2 from "argon2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
export async function hashPassword(password) {
    return argon2.hash(password);
}
export async function checkPasswordHash(password, hash) {
    return argon2.verify(hash, password);
}
export function makeJWT(userID, expiresIn, secret) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = {
        iss: "chirpy",
        sub: userID,
        iat: issuedAt,
        exp: issuedAt + expiresIn,
    };
    return jwt.sign(payload, secret);
}
export function validateJWT(tokenString, secret) {
    try {
        const decoded = jwt.verify(tokenString, secret);
        if (typeof decoded === "string" || !decoded.sub) {
            throw new Error("Invalid token");
        }
        return decoded.sub;
    }
    catch (error) {
        throw new Error("Invalid or expired token");
    }
}
export function getBearerToken(req) {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
        throw new Error("Missing Authorization header");
    }
    if (!authHeader.startsWith("Bearer ")) {
        throw new Error("Invalid Authorization header");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
        throw new Error("Invalid Authorization header");
    }
    return token;
}
export function makeRefreshToken() {
    return crypto.randomBytes(32).toString("hex");
}
