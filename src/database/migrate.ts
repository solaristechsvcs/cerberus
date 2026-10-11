import { connectDatabase, sequelize } from "./index";
import "./models/Warning";
import "./models/ModerationCase";
import "./models/GuildSettings";
import "./models/UserNote";
import "./models/SuggestionSettings";
import "./models/SuggestionPanel";
import "./models/Suggestion";
import "./models/Poll";

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
