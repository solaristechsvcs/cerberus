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

Dashboard sessions expire after eight hours and persist in SQL across restarts. Session and OAuth identifiers are stored as SHA-256 hashes. OAuth state expires after ten minutes and is consumed once. The dashboard_auth table is created by existing startup migrations. All instances must use the same database.

## Features

- Server selector for administrator-accessible guilds
- Moderation case history
- Staff note history
- User-ID filtering
- Case IDs, action, moderator, reason, and timestamp
- Note IDs, author, content, and timestamp
- Responsive staff interface

## Wisp and reverse proxies

- Set dashboard.publicUrl in config.js to the exact browser origin, such as https://dashboard.example.com, without a path. Include any non-default external port. This project reads config.js, not dashboard environment variables.
- Register exactly <publicUrl>/oauth/callback in the same Discord application's OAuth2 redirect list. discord.clientId and dashboard.clientSecret must belong to that application. Keep the secret private.
- Forward the external Host header and overwrite X-Forwarded-Proto with https at the trusted HTTPS proxy. Set dashboard.trustProxy to the proxy IP/CIDR or an array of CIDRs. Use 1 only when every connection passes through exactly one trusted proxy and direct backend access is blocked. The default is false; never use unrestricted true.
- Keep dashboard.port as the Wisp allocation's internal listening port; route the subdomain to that port. Cookie security follows publicUrl, independently of proxy headers.
- Restart after config changes and begin a fresh login at the configured public URL. Login on another origin redirects there before setting the state cookie.
- Temporary HTTP IP testing requires an exact http://IP:PORT public URL and matching Discord callback. Cookies then omit Secure. Use HTTPS for production because HTTP exposes login cookies to network interception.
- The database user needs table creation permission for startup migrations. No new secret, Redis service, or environment variable is required.

Expired, missing, mismatched, malformed and consumed state is rejected. Start a fresh login after cancellation or failure. Simultaneous login attempts in one browser replace the state cookie; finish the latest attempt.
