import { readFileSync } from "node:fs";
export function databaseConfig() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("Invalid database configuration");
  }
  if (process.env.DATABASE_SSL === "true")
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
      url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_CA_FILE
              ? { ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8") }
              : {}),
          }
        : undefined,
  };
}
