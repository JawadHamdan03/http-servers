import { asc } from "drizzle-orm";
import { db } from "../index.js";
import { chirps } from "../schema.js";
export async function createChirp(chirp) {
    const [result] = await db.insert(chirps).values(chirp).returning();
    return result;
}
export async function getChirps() {
    return db.select().from(chirps).orderBy(asc(chirps.createdAt));
}
