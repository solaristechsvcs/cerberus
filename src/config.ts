import "dotenv/config";

type Dialect = "postgres" | "mysql";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const dialect = (process.env.DB_DIALECT ?? "postgres") as Dialect;
if (!["postgres", "mysql"].includes(dialect)) {
  throw new Error("DB_DIALECT must be postgres or mysql");
}

export const config = {
  discord: {
    token: required("DISCORD_TOKEN"),
    clientId: required("DISCORD_CLIENT_ID"),
    guildId: process.env.DISCORD_GUILD_ID
  },
  database: {
    dialect,
    host: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? (dialect === "postgres" ? 5432 : 3306)),
    name: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    ssl: process.env.DB_SSL === "true"
  },
  logLevel: process.env.LOG_LEVEL ?? "info"
} as const;
