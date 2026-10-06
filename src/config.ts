type Dialect = "postgres" | "mysql";

type CerberusConfig = {
  discord: { token: string; clientId: string };
  database: { dialect: Dialect; host: string; port: number; name: string; user: string; password: string; ssl: boolean };
  dashboard: { enabled: boolean; port: number; publicUrl: string; clientSecret: string; globalAdmins?: string[] };
  logLevel: string;
};

const config = require("../config.js") as CerberusConfig;

if (!config.discord.token || config.discord.token === "CHANGE_ME") throw new Error("Set discord.token in config.js");
if (!config.discord.clientId || config.discord.clientId === "CHANGE_ME") throw new Error("Set discord.clientId in config.js");
if (!["postgres", "mysql"].includes(config.database.dialect)) throw new Error("database.dialect must be postgres or mysql");

export { config };
