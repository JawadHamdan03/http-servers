import { db } from "../index.js";
import { users } from "../schema.js";
import { eq } from "drizzle-orm";
export async function createUser(user) {
    const [result] = await db
        .insert(users)
        .values(user)
        .onConflictDoNothing()
        .returning();
    return result;
}
export async function deleteAllUsers() {
    await db.delete(users);
}
export async function getUserByEmail(email) {
    const [result] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
    return result;
}
export async function updateUserById(id, email, hashedPassword) {
    const [result] = await db
        .update(users)
        .set({ email, hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
    return result;
}
export async function upgradeUserToChirpyRed(id) {
    const [result] = await db
        .update(users)
        .set({ isChirpyRed: true, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
    return result;
}
