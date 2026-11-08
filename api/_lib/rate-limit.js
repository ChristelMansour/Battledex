// Sliding-window rate limiter: 5 requests per minute per IP.
//
// State lives in a small JSON file in the OS temp folder, not in memory:
// `vercel dev` starts a fresh process for every request, so an in-memory Map
// would reset each time. This is fine for local use (this build never deploys).
// A deployed app would need a shared store instead.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LIMIT = 5;
const WINDOW_MS = 60_000;
const STORE_FILE = path.join(os.tmpdir(), "battledex-rate-limit.json");

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return {}; // missing or unreadable file: start fresh
  }
}

function writeStore(store) {
  // Write to a temp file, then rename, so a reader never sees a half-written file.
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, STORE_FILE);
}

// Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
export function checkRateLimit(ip) {
  const now = Date.now();
  const store = readStore();

  // Drop expired timestamps for every IP so the file stays small.
  for (const key of Object.keys(store)) {
    store[key] = store[key].filter((t) => now - t < WINDOW_MS);
    if (store[key].length === 0) delete store[key];
  }

  const recent = store[ip] || [];
  if (recent.length >= LIMIT) {
    writeStore(store);
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  store[ip] = [...recent, now];
  writeStore(store);
  return { allowed: true };
}
