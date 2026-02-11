import process from "process";
import type { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile();

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}


export type APIConfig = {
  fileserverHits: number;
  platform: string;
  jwtSecret: string;
};

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};





const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migrations",
};

export const config: APIConfig & DBConfig = {
  fileserverHits: 0,
  platform: envOrThrow("PLATFORM"),
  jwtSecret: envOrThrow("JWT_SECRET"),
  url: envOrThrow("DB_URL"),
  migrationConfig
};
