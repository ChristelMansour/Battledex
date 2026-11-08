// BattleDex frontend: fight form → /api/fight → winner card, plus the
// BattleDex collection of saved fighters (localStorage).
// Visual design: "Battleground Arcade" (Battleground.html).

const REQUEST_TIMEOUT_MS = 30_000; // loading never hangs forever
const DEX_STORAGE_KEY = "battledex.fighters";
const PROGRESS_SEGMENTS = 10;

const LOADING_MESSAGES = [
  "CALCULATING DESTINY…",
  "SIZING UP FIGHTERS…",
  "CONSULTING THE JUDGE…",
  "SKETCHING PORTRAITS…",
  "TALLYING SCORES…",
];

const TIPS = [
  "Weirder names hit harder. Nobody knows why.",
  "Groups count as one fighter. 10 cows = 1 very large problem.",
  "Save your favourite fighters to your BattleDex.",
  "Mirror matches still crown a champ. No ties, ever.",
];

const RANDOM_FIGHTERS = [
  "Glitter Goblin", "Captain Biscuit", "Duchess Thunder", "Lil Cupcake Rex",
  "Velvet Viper", "Sir Moth Pudding", "10 angry geese", "A haunted toaster",
  "Princess Sprinkles", "The Mighty Dust Bunny", "Disco Kraken", "3 very brave cats",
];

// ---------------------------------------------------------------------------
// Views: only one is ever visible at a time.

const views = {
  form: document.getElementById("view-form"),
  loading: document.getElementById("view-loading"),
  result: document.getElementById("view-result"),
  error: document.getElementById("view-error"),
  dex: document.getElementById("view-dex"),
};

const nav = document.getElementById("bottom-nav");
const navArena = document.getElementById("nav-arena");
const navDex = document.getElementById("open-dex");

function showView(name) {
  for (const key in views) {
    views[key].hidden = key !== name;
  }
  // The nav would interrupt a fight in progress, and the result has its own buttons.
  nav.hidden = name === "loading" || name === "result";
  navDex.disabled = name === "loading";
  navArena.toggleAttribute("aria-current", name === "form");
  navDex.toggleAttribute("aria-current", name === "dex");
  if (name === "form") navArena.setAttribute("aria-current", "page");
  if (name === "dex") navDex.setAttribute("aria-current", "page");
  window.scrollTo({ top: 0 });
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showView("error");
}

// ---------------------------------------------------------------------------
// Round counter (this session only) shown on the loading and result screens.

let round = 0;

function setRoundBadges() {
  document.querySelector("#view-loading .round-badge").textContent = `ROUND ${round}`;
  document.querySelector("#view-result .round-badge").textContent = `R${round}`;
}

// ---------------------------------------------------------------------------
// Loading view: VS screen, rotating status text, segmented progress bar, tips.

const progress = document.getElementById("progress");
for (let i = 0; i < PROGRESS_SEGMENTS; i++) {
  progress.append(document.createElement("span"));
}

let statusTimer = null;
let progressTimer = null;

function setProgress(filled) {
  [...progress.children].forEach((segment, i) => {
    segment.classList.toggle("is-on", i < filled);
    segment.classList.toggle("is-next", i === filled);
  });
}

function startLoading(fighterA, fighterB) {
  document.getElementById("loading-name-a").textContent = fighterA;
  document.getElementById("loading-name-b").textContent = fighterB;
  document.getElementById("loading-tip").textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

  // Restart the slide-in animations
  views.loading.querySelectorAll(".slide-left, .slide-right").forEach((el) => {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  });

  const text = document.getElementById("loading-text");
  let i = 0;
  text.textContent = LOADING_MESSAGES[0];
  clearInterval(statusTimer);
  statusTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    text.textContent = LOADING_MESSAGES[i];
  }, 1400);

  // Fill quickly at first, then slow down; never reach the end until done.
  let filled = 0;
  setProgress(0);
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (filled < PROGRESS_SEGMENTS - 1) setProgress(++filled);
  }, 450);

  showView("loading");
}

async function finishLoading() {
  clearInterval(statusTimer);
  clearInterval(progressTimer);
  setProgress(PROGRESS_SEGMENTS);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

// ---------------------------------------------------------------------------
// Fight API

// Returns the parsed result, or throws an Error whose message is safe to show.
async function requestFight(fighterA, fighterB) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch("/api/fight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fighterA, fighterB }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("The judge is taking too long. Please try again.");
    }
    throw new Error("Couldn't reach the arena. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // fall through to the generic message below
  }

  if (!response.ok) {
    // The server sends a specific message per error type
    // (bad_request, rate_limited, verdict_failed, image_failed, image_blocked).
    throw new Error(data?.error?.message || "Something went wrong. Please try again.");
  }
  if (!data || !data.fighters?.A || !data.fighters?.B || (data.winner !== "A" && data.winner !== "B")) {
    throw new Error("The judge's verdict got garbled. Please try again.");
  }
  return data;
}

// Runs a whole fight: loading screen → API → result or error.
const fightButton = document.querySelector("#fight-form button[type=submit]");
let lastFight = null; // most recent result, kept in memory for "Last fight"

async function runFight(fighterA, fighterB) {
  if (!fighterA || !fighterB) {
    showError("Please enter both fighters.");
    return;
  }

  fightButton.disabled = true;
  round += 1;
  setRoundBadges();
  startLoading(fighterA, fighterB);

  try {
    const data = await requestFight(fighterA, fighterB);
    await finishLoading();
    lastFight = data;
    renderResult(data);
    showView("result");
  } catch (err) {
    await finishLoading();
    showError(err.message);
  } finally {
    fightButton.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Result view (winner spotlight + defeated row)

const loserCorner = (data) => (data.winner === "A" ? "B" : "A");

function renderResult(data) {
  const winner = data.fighters[data.winner];
  const loser = data.fighters[loserCorner(data)];

  document.getElementById("winner-name").textContent = winner.name;
  document.getElementById("winner-image").src = winner.image;
  document.getElementById("winner-image").alt = winner.name;
  document.getElementById("loser-name").textContent = loser.name;
  document.getElementById("loser-image").src = loser.image;
  document.getElementById("loser-image").alt = loser.name;
  document.getElementById("reasoning").textContent = data.reasoning;
  setSaveStatus("");

  for (const button of document.querySelectorAll(".js-save")) {
    updateSaveButton(button, fighterForSlot(data, button.dataset.slot).name);
  }

  // Replay the entry animation every time a result is shown.
  const card = document.getElementById("result-card");
  card.classList.remove("reveal");
  void card.offsetWidth;
  card.classList.add("reveal");
}

function fighterForSlot(data, slot) {
  return data.fighters[slot === "winner" ? data.winner : loserCorner(data)];
}

function setSaveStatus(message, isError = false) {
  const status = document.getElementById("save-status");
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function updateSaveButton(button, label) {
  const saved = isInDex(label);
  button.disabled = saved;
  button.textContent = saved ? "Saved ✓" : "♡ Save";
  button.setAttribute("aria-label", saved ? `${label} is in your BattleDex` : `Save ${label} to BattleDex`);
}

// ---------------------------------------------------------------------------
// Image compression: shrink images before saving to localStorage.

const MAX_IMAGE_SIDE = 256; // cards display images much smaller than this
const IMAGE_QUALITY = 0.75;

// Resizes and re-encodes an image as WebP (or JPEG if the browser can't make
// WebP). Returns whichever is smaller: the compressed or the original, so tiny
// images (like the SVG placeholders) are never made bigger. Never rejects.
function compressImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth || MAX_IMAGE_SIDE;
        const height = img.naturalHeight || MAX_IMAGE_SIDE;
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // JPEG has no transparency
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let compressed = canvas.toDataURL("image/webp", IMAGE_QUALITY);
        if (!compressed.startsWith("data:image/webp")) {
          compressed = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
        }
        resolve(compressed.length < src.length ? compressed : src);
      } catch {
        resolve(src); // e.g. a cross-origin image taints the canvas
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// BattleDex storage: an array of { label, image } in localStorage.

function loadDex() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEX_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) => entry && typeof entry.label === "string" && typeof entry.image === "string",
    );
  } catch {
    return [];
  }
}

// Returns true if saved, false if storage is full or unavailable.
function writeDex(entries) {
  try {
    localStorage.setItem(DEX_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

const sameLabel = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function isInDex(label) {
  return loadDex().some((entry) => sameLabel(entry.label, label));
}

async function saveFighter(button) {
  if (!lastFight) return;
  const fighter = fighterForSlot(lastFight, button.dataset.slot);

  button.disabled = true;
  button.textContent = "Saving…";

  const image = await compressImage(fighter.image);
  const entries = loadDex();
  if (!entries.some((entry) => sameLabel(entry.label, fighter.name))) {
    entries.push({ label: fighter.name, image });
    if (!writeDex(entries)) {
      button.disabled = false;
      button.textContent = "♡ Save";
      setSaveStatus("Your BattleDex is full. Remove a fighter to make room.", true);
      return;
    }
  }

  updateSaveButton(button, fighter.name);
  setSaveStatus(`${fighter.name} was added to your BattleDex.`);
  updateDexCount();
}

function updateDexCount() {
  const count = loadDex().length;
  document.getElementById("dex-count").textContent = count;
  document.getElementById("dex-total").textContent = count;
}

function renderDex() {
  const entries = loadDex();
  const query = document.getElementById("dex-search").value.trim().toLowerCase();
  const grid = document.getElementById("dex-grid");
  grid.replaceChildren();

  let shown = 0;
  entries.forEach((entry, index) => {
    if (query && !entry.label.toLowerCase().includes(query)) return;
    shown += 1;

    const item = document.createElement("li");
    item.className = "dex-card";

    const num = document.createElement("span");
    num.className = "dex-num";
    num.textContent = `#${String(index + 1).padStart(3, "0")}`;

    const img = document.createElement("img");
    img.src = entry.image;
    img.alt = entry.label;

    const name = document.createElement("span");
    name.className = "dex-name";
    name.textContent = entry.label;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "dex-delete";
    remove.setAttribute("aria-label", `Remove ${entry.label}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      const current = loadDex();
      current.splice(index, 1);
      writeDex(current);
      renderDex();
    });

    item.append(num, img, name, remove);
    grid.append(item);
  });

  document.getElementById("dex-empty").hidden = entries.length > 0;
  document.getElementById("dex-no-match").hidden = entries.length === 0 || shown > 0;
  document.getElementById("clear-dex").hidden = entries.length === 0;
  document.getElementById("back-to-fight").hidden = !lastFight;
  updateDexCount();
}

function openDex() {
  renderDex();
  showView("dex");
}

// ---------------------------------------------------------------------------
// Event wiring

document.getElementById("fight-form").addEventListener("submit", (event) => {
  event.preventDefault(); // stop the page from reloading
  runFight(
    document.getElementById("fighter-a").value.trim(),
    document.getElementById("fighter-b").value.trim(),
  );
});

document.getElementById("shuffle").addEventListener("click", () => {
  const a = Math.floor(Math.random() * RANDOM_FIGHTERS.length);
  let b = Math.floor(Math.random() * (RANDOM_FIGHTERS.length - 1));
  if (b >= a) b += 1; // never the same fighter twice
  document.getElementById("fighter-a").value = RANDOM_FIGHTERS[a];
  document.getElementById("fighter-b").value = RANDOM_FIGHTERS[b];
});

document.getElementById("rematch").addEventListener("click", () => {
  if (lastFight) runFight(lastFight.fighters.A.name, lastFight.fighters.B.name);
});

document.querySelectorAll(".js-save").forEach((button) => {
  button.addEventListener("click", () => saveFighter(button));
});

document.querySelectorAll(".js-new-fight").forEach((button) => {
  button.addEventListener("click", () => showView("form"));
});

navDex.addEventListener("click", openDex);
document.querySelectorAll(".js-open-dex").forEach((button) => {
  button.addEventListener("click", openDex);
});

document.getElementById("dex-search").addEventListener("input", renderDex);

document.getElementById("back-to-fight").addEventListener("click", () => {
  if (!lastFight) return;
  renderResult(lastFight); // refreshes the Save buttons too
  showView("result");
});

document.getElementById("clear-dex").addEventListener("click", () => {
  if (window.confirm("Remove every fighter from your BattleDex?")) {
    writeDex([]);
    document.getElementById("dex-search").value = "";
    renderDex();
  }
});

// On load, only the form is visible.
updateDexCount();
showView("form");
