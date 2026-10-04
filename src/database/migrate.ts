import { connectDatabase, sequelize } from "./index";
import "./models/Warning";

async function main(): Promise<void> {
  await connectDatabase();
  await sequelize.sync();
  console.log("Database schema is ready.");
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
