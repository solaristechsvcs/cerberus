import { moderationCommands } from "./commands/moderation";
import { noteCommands } from "./commands/notes";
import { codeCommands } from "./commands/codes";
import { ticketCommands } from "./commands/tickets";
import { developerCommands } from "./commands/developer";
import { verificationCommands } from "./commands/verification";
import { announcementCommands } from "./commands/announcements";
import { developerDmCommands } from "./commands/developerDm";
import { welcomeCommands } from "./commands/welcome";
import { changelogCommands } from "./commands/changelog";
import { antiRaidCommands } from "./commands/antiRaid";
import { inviteCommands } from "./commands/invites";
import { buildCommands } from "./commands/builds";
import { nukaTraderCommands } from "./commands/nukaTrader";

export const commandData = [...moderationCommands, ...noteCommands, ...codeCommands, ...ticketCommands, ...developerCommands, ...verificationCommands, ...announcementCommands, ...developerDmCommands, ...welcomeCommands, ...changelogCommands, ...antiRaidCommands, ...inviteCommands, ...buildCommands, ...nukaTraderCommands].map(command => command.toJSON());
