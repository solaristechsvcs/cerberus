import { Sequelize } from "sequelize";
import { config } from "../config";

export const sequelize = new Sequelize(
  config.database.name,
  config.database.user,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    logging: false,
    dialectOptions: config.database.ssl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : undefined
  }
);

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  console.log(`Database connected (${config.database.dialect}).`);
}
