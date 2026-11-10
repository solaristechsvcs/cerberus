# Cerberus automatic updates on Wisp

Cerberus can poll the private GitHub repository's `main` branch and restart itself after a successful TypeScript build.

## Wisp configuration

1. Deploy Cerberus as a **Git checkout** (the server directory must contain `.git`). A ZIP upload is not enough.
2. Configure read-only Git credentials for the private repository on the host. Use a credential manager, GitHub App installation token, or a read-only deploy key; do not put tokens in this repository or `config.js`.
3. Set Wisp's **Startup Command** to:
   ```sh
   npm install --include=dev && node scripts/wisp-auto-update.cjs
   ```
   The Wisp egg must allow editing its startup command. Setting only `MAIN_FILE` is insufficient if the egg forces `ts-node`.
4. Restart the server. The supervisor starts the compiled bot and checks for new commits immediately and every five minutes.
5. Optional: set `CERBERUS_UPDATE_SECONDS=300` and `CERBERUS_UPDATE_BRANCH=main` in Wisp environment variables.

## Safeguards and limitations

- Updates are **fast-forward only**; no force reset, hard checkout or local change deletion.
- If tracked files are modified locally (including tracked `config.js`), updates are skipped. Keep secrets in Wisp's protected environment or move production configuration to an untracked local file using a separate configuration change. Do **not** commit credentials.
- The updater never touches MySQL data. It does not automatically run migrations.
- The bot keeps running if Git fetch, dependency installation or compilation fails. Check Wisp console for the reason; a failed build after Git advances requires a manual rebuild or a new commit.
- The host needs `git`, `npm`, Node.js 22+ and access to GitHub. The updater does not create Git credentials.
- Wisp must be configured to restart the instance if the supervisor exits unexpectedly.
- Never run both the supervisor and a separate bot entry point, as that would launch two bot processes.
