# Cerberus Admin Dashboard

The dashboard is restricted to Discord users who have **Administrator** permission (or own the guild) in at least one Discord server visible to their OAuth account.

## Configuration

Set these values in `config.js`:

- `dashboard.enabled`
- `dashboard.port`
- `dashboard.publicUrl`
- `dashboard.clientSecret`

The Discord application must have the dashboard callback registered as:

`<publicUrl>/oauth/callback`

For example, if the dashboard is served at `https://dashboard.example.com`, register:

`https://dashboard.example.com/oauth/callback`

The dashboard uses Discord OAuth2 scopes `identify guilds`. It does not ask for bot permissions.

## Security model

1. A user signs in through Discord.
2. Cerberus retrieves the user's Discord guild list and permissions.
3. Only guilds where the user is the owner or has Administrator permission are exposed.
4. Every database API request checks the authenticated session against the requested guild.
5. User notes and moderation cases are never returned to non-administrators.
6. Notes are also staff-only in Discord: `/note` and `/notes` require Moderate Members; deleting notes requires Manage Server.

The dashboard session is kept in memory and expires after eight hours. Restarting Cerberus invalidates active dashboard sessions.

## Features

- Server selector for administrator-accessible guilds
- Moderation case history
- Staff note history
- User-ID filtering
- Case IDs, action, moderator, reason, and timestamp
- Note IDs, author, content, and timestamp
- Responsive staff interface
