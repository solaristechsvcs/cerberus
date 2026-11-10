"use strict";

/**
 * Wisp supervisor: starts Cerberus and checks for fast-forward updates.
 * Requires a Git checkout with read access to origin/main.
 * Never resets local files or force-overwrites configuration.
 */
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
const branch = process.env.CERBERUS_UPDATE_BRANCH || "main";
const interval = Math.max(60, Number(process.env.CERBERUS_UPDATE_SECONDS) || 300) * 1000;
let bot = null;
let stopping = false;
let checking = false;
let lastCommit = null;

function command(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(cmd + " exited with code " + code)));
  });
}
function output(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: "utf8", timeout: 30000 });
  if (result.status !== 0) throw new Error((result.stderr || result.error?.message || cmd + " failed").trim());
  return result.stdout.trim();
}
function startBot() {
  if (stopping) return;
  console.log("[Cerberus updater] Starting bot");
  bot = spawn(process.execPath, ["dist/index.js"], { cwd: root, stdio: "inherit", env: process.env });
  bot.on("error", err => console.error("[Cerberus updater] Bot start error:", err.message));
  bot.on("exit", (code, signal) => {
    bot = null;
    if (stopping) return;
    console.error("[Cerberus updater] Bot exited:", code, signal, "- supervisor exiting for Wisp restart");
    process.exit(code || 1);
  });
}
async function stopBot() {
  if (!bot) return;
  const current = bot;
  await new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    current.once("exit", finish);
    current.kill("SIGTERM");
    const timeout = setTimeout(() => { if (current.exitCode === null) current.kill("SIGKILL"); finish(); }, 15000);
    timeout.unref();
  });
}
async function update() {
  if (checking || stopping) return;
  checking = true;
  try {
    if (!fs.existsSync(path.join(root, ".git"))) {
      console.warn("[Cerberus updater] No .git directory. Automatic updates require a Git checkout.");
      return;
    }
    // Only config.js may be locally edited. Never overwrite other tracked changes.
    const dirty = output("git", ["status", "--porcelain", "--untracked-files=no"]);
    const changed = dirty.split("\\n").filter(Boolean).map(line => line.slice(3));
    const unexpected = changed.filter(file => file !== "config.js");
    if (unexpected.length) {
      console.warn("[Cerberus updater] Other tracked files have local edits; skipping update:", unexpected.join(", "));
      return;
    }
    await command("git", ["fetch", "--quiet", "origin", branch]);
    const local = output("git", ["rev-parse", "HEAD"]);
    const remote = output("git", ["rev-parse", "FETCH_HEAD"]);
    if (local === remote) return;
    const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", local, remote], { cwd: root });
    if (ancestor.status !== 0) {
      console.warn("[Cerberus updater] Branch has diverged; refusing to overwrite local commits.");
      return;
    }
    console.log("[Cerberus updater] New commit available:", remote.slice(0, 12));
    // Back up production config outside the checkout before a fast-forward merge.
    // The backup survives a failed merge; local credentials are never fetched from GitHub.
    const configPath = path.join(root, "config.js");
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "cerberus-config-"));
    const backupPath = path.join(backupDir, "config.js");
    const hadConfig = fs.existsSync(configPath);
    if (hadConfig) fs.copyFileSync(configPath, backupPath);
    try {
      if (changed.includes("config.js")) {
        await command("git", ["restore", "--staged", "--worktree", "--", "config.js"]);
      }
      await command("git", ["merge", "--ff-only", remote]);
    } finally {
      if (hadConfig) fs.copyFileSync(backupPath, configPath);
      else if (fs.existsSync(configPath)) fs.rmSync(configPath);
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    console.log("[Cerberus updater] GitHub files updated; local config.js preserved.");
    await command("npm", ["install", "--include=dev"]);
    await command("npm", ["run", "build"]);
    lastCommit = remote;
    console.log("[Cerberus updater] Build successful. Restarting bot.");
    // Prevent the exit listener from terminating the supervisor during intentional restart.
    const old = bot;
    if (old) {
      bot = null;
      old.removeAllListeners("exit");
      await new Promise(resolve => {
        old.once("exit", resolve);
        old.kill("SIGTERM");
        const timer = setTimeout(() => { if (old.exitCode === null) old.kill("SIGKILL"); resolve(); }, 15000);
        timer.unref();
      });
    }
    startBot();
  } catch (error) {
    console.error("[Cerberus updater] Update failed:", error.message);
    // Leave the current bot process running if update/build failed.
  } finally { checking = false; }
}
async function main() {
  if (!fs.existsSync(path.join(root, "dist/index.js"))) {
    console.log("[Cerberus updater] First build");
    await command("npm", ["install", "--include=dev"]);
    await command("npm", ["run", "build"]);
  }
  startBot();
  setInterval(update, interval).unref();
  await update();
}
process.on("SIGTERM", () => { stopping = true; if (bot) bot.kill("SIGTERM"); else process.exit(0); });
process.on("SIGINT", () => { stopping = true; if (bot) bot.kill("SIGINT"); else process.exit(0); });
main().catch(error => { console.error("[Cerberus updater] Startup failed:", error.message); process.exit(1); });
