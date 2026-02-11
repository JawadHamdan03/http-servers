import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { getBearerToken, makeJWT, validateJWT } from "./auth";

describe("JWT", () => {
    const userID = "user-123";
    const secret = "super-secret";

    it("creates and validates a token", () => {
        const token = makeJWT(userID, 60, secret);
        const result = validateJWT(token, secret);
        expect(result).toBe(userID);
    });

    it("rejects expired tokens", () => {
        const token = makeJWT(userID, -1, secret);
        expect(() => validateJWT(token, secret)).toThrow();
    });

    it("rejects tokens signed with the wrong secret", () => {
        const token = makeJWT(userID, 60, secret);
        expect(() => validateJWT(token, "wrong-secret")).toThrow();
    });
});

describe("getBearerToken", () => {
    it("returns the token string from the Authorization header", () => {
        const req = {
            get: (header: string) =>
                header === "Authorization" ? "Bearer test-token" : undefined,
        } as unknown as Request;

        const token = getBearerToken(req);
        expect(token).toBe("test-token");
    });

    it("throws when the header is missing", () => {
        const req = {
            get: () => undefined,
        } as unknown as Request;

        expect(() => getBearerToken(req)).toThrow();
    });

    it("throws when the header is not a Bearer token", () => {
        const req = {
            get: (header: string) =>
                header === "Authorization" ? "Basic abc" : undefined,
        } as unknown as Request;

        expect(() => getBearerToken(req)).toThrow();
    });
});
