import process from "process";
process.loadEnvFile();
function envOrThrow(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
}
const migrationConfig = {
    migrationsFolder: "./src/db/migrations",
};
export const config = {
    fileserverHits: 0,
    platform: envOrThrow("PLATFORM"),
    url: envOrThrow("DB_URL"),
    migrationConfig
};
