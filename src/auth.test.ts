import { describe, expect, it } from "vitest";
import { makeJWT, validateJWT } from "./auth";

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
