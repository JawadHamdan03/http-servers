import { asc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { chirps } from "../schema.js";
export async function createChirp(chirp) {
    const [result] = await db.insert(chirps).values(chirp).returning();
    return result;
}
export async function getChirps() {
    return db.select().from(chirps).orderBy(asc(chirps.createdAt));
}
export async function getChirpById(id) {
    const [result] = await db
        .select()
        .from(chirps)
        .where(eq(chirps.id, id));
    return result;
}
export async function deleteChirpById(id) {
    const [result] = await db
        .delete(chirps)
        .where(eq(chirps.id, id))
        .returning();
    return result;
}
