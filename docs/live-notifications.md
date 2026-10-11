# Live notifications

Open **General Settings → Live Notifications** in the dashboard. Add a Twitch username, YouTube @handle/channel ID or TikTok username (creator URLs also work), select the Discord channel and optionally select a role to ping. Customize the message with `{creator}`, `{platform}`, `{title}` and `{url}`. You can edit, pause, resume, remove and send a test alert. Test alerts never ping anyone. Only server administrators or configured dashboard administrators can change these settings.

## Host setup

Set these environment variables on the machine running Cerberus, then restart:

- `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`: create an application in the [Twitch developer console](https://dev.twitch.tv/console/apps). Cerberus obtains an app access token using client credentials; creators do not need to sign in.
- `YOUTUBE_API_KEY`: enable YouTube Data API v3 in your Google Cloud project and create a server-side API key. Restrict it to that API and, where possible, the bot host's public IP.
- Optional `YOUTUBE_DAILY_SEARCH_LIMIT`: default 90 live searches per Pacific calendar day shared across all servers and creators. Set this within your project's approved search quota. Other applications sharing the same key also consume that project's quota.

Alternatively add an optional `liveNotifications` object to your existing root `config.js` export, preserving its existing settings:

```js
liveNotifications: {
  twitchClientId: "YOUR_CLIENT_ID",
  twitchClientSecret: "YOUR_CLIENT_SECRET",
  youtubeApiKey: "YOUR_API_KEY",
  youtubeDailySearchLimit: 90
}
```

Environment variables override these fields. Credentials stay on the bot host and are never returned to the dashboard. No TikTok credentials are required.

Cerberus needs **View Channel**, **Send Messages** and **Embed Links** in each destination. A selected notification role must be mentionable, or Cerberus needs **Mention Everyone** there. Notifications allow only the selected role mention; user mentions and @everyone/@here text in messages cannot ping.

## Detection and delivery

Twitch uses the official Streams API and checks about every minute. YouTube checks its channel feed and confirms actual live broadcasts using the official Videos API about every two minutes. Scheduled and ended broadcasts are excluded. A paced official live-search fallback catches broadcasts missing from the feed: approximately 16 minutes for one creator at the default budget, increasing with the number of unique enabled YouTube creators across all servers. Exhausted quota, blocked feeds and slow provider responses can delay discovery further. The dashboard shows the current search interval and the latest check or delivery error.

YouTube search reservations and discovered broadcast IDs persist across restarts. The default search budget leaves some room below the documented default of 100 search calls per day; check your own Google project's quota before increasing it. See [YouTube quota costs](https://developers.google.com/youtube/v3/determine_quota_cost) and [live broadcast metadata](https://developers.google.com/youtube/v3/docs/videos).

TikTok uses an **unofficial public website status endpoint**. It can be blocked by TikTok or change without notice. Unknown or blocked responses produce a visible error rather than an offline result. TikTok is therefore best effort and is clearly marked experimental in the dashboard.

Successful deliveries are stored by configuration and stream ID. Ordinary restarts, repeated checks and offline/online fluctuations in the same broadcast do not repeat alerts. A deterministic Discord nonce also reduces repeats if the process stops between sending and saving. Discord's nonce deduplication window is limited, so a prolonged crash at precisely that point can still repeat a message. A failed send retries on a later check. New configurations can announce an already-live stream; each genuinely new broadcast ID gets its own alert. Removing and adding a creator again creates a new configuration.

New tables are created by the existing startup schema sync. Pull the update, run `npm install` and `npm run build`, configure credentials, and restart Cerberus. Existing dashboard settings, polls, suggestions and role panels are preserved.
