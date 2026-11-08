// BattleDex frontend: fight form → /api/fight → winner card, plus the
// BattleDex collection of saved fighters (localStorage).

const REQUEST_TIMEOUT_MS = 30_000; // loading never hangs forever
const DEX_STORAGE_KEY = "battledex.fighters";
const LOADING_MESSAGES = [
  "Sizing up the fighters…",
  "Consulting the judge…",
  "Sketching portraits…",
  "Tallying the scores…",
  "Almost there…",
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

function showView(name) {
  for (const key in views) {
    views[key].hidden = key !== name;
  }
  // The header BattleDex button would interrupt a fight in progress.
  document.getElementById("open-dex").disabled = name === "loading";
  window.scrollTo({ top: 0 });
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showView("error");
}

// ---------------------------------------------------------------------------
// Loading view: rotating status text + progress bar.

let loadingTimer = null;

function startLoading() {
  const text = document.getElementById("loading-text");
  const bar = document.getElementById("progress-bar");
  let i = 0;
  text.textContent = LOADING_MESSAGES[0];
  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    text.textContent = LOADING_MESSAGES[i];
  }, 1400);

  bar.className = "progress-bar";
  void bar.offsetWidth; // restart the transition from 0
  bar.classList.add("is-running");
  showView("loading");
}

// Fill the bar, give it a moment to show, then stop the loading view.
async function finishLoading() {
  clearInterval(loadingTimer);
  const bar = document.getElementById("progress-bar");
  bar.classList.add("is-done");
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

// ---------------------------------------------------------------------------
// Result view (winner card)

let lastFight = null; // most recent result, kept in memory for "Back to last fight"

function renderResult(data) {
  const card = document.getElementById("result-card");
  const winnerName = data.fighters[data.winner].name;
  document.getElementById("winner-name").textContent = winnerName;
  document.getElementById("reasoning").textContent = data.reasoning;
  setSaveStatus("");

  for (const corner of ["A", "B"]) {
    const fighter = data.fighters[corner];
    const id = corner.toLowerCase();
    const isWinner = corner === data.winner;

    const figure = document.getElementById(`corner-${id}`);
    figure.classList.toggle("is-winner", isWinner);
    figure.classList.toggle("is-loser", !isWinner);
    figure.querySelector(".tag").textContent = isWinner ? "Winner" : "Defeat";

    const img = document.getElementById(`image-${id}`);
    img.src = fighter.image;
    img.alt = fighter.name;
    document.getElementById(`caption-${id}`).textContent = fighter.name;

    updateSaveButton(figure.querySelector(".js-save"), fighter.name);
  }

  // Replay the entry animation every time a result is shown.
  card.classList.remove("reveal");
  void card.offsetWidth;
  card.classList.add("reveal");
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
// Image compression (Stage 5): shrink images before saving to localStorage.

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
// BattleDex storage (Stage 4): an array of { label, image } in localStorage.

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
  const fighter = lastFight.fighters[button.dataset.corner];

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
  document.getElementById("dex-count").textContent = loadDex().length;
}

function renderDex() {
  const entries = loadDex();
  const grid = document.getElementById("dex-grid");
  grid.replaceChildren();

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "dex-card";

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

    item.append(img, name, remove);
    grid.append(item);
  });

  document.getElementById("dex-empty").hidden = entries.length > 0;
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

const fightForm = document.getElementById("fight-form");
const fightButton = fightForm.querySelector("button[type=submit]");

fightForm.addEventListener("submit", async (event) => {
  event.preventDefault(); // stop the page from reloading

  const fighterA = document.getElementById("fighter-a").value.trim();
  const fighterB = document.getElementById("fighter-b").value.trim();

  if (!fighterA || !fighterB) {
    showError("Please enter both fighters.");
    return;
  }

  fightButton.disabled = true;
  startLoading();

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
});

document.querySelectorAll(".js-save").forEach((button) => {
  button.addEventListener("click", () => saveFighter(button));
});

document.querySelectorAll(".js-new-fight").forEach((button) => {
  button.addEventListener("click", () => showView("form"));
});

document.getElementById("open-dex").addEventListener("click", openDex);
document.querySelectorAll(".js-open-dex").forEach((button) => {
  button.addEventListener("click", openDex);
});

document.getElementById("back-to-fight").addEventListener("click", () => {
  if (!lastFight) return;
  renderResult(lastFight); // refreshes the Save buttons too
  showView("result");
});

document.getElementById("clear-dex").addEventListener("click", () => {
  if (window.confirm("Remove every fighter from your BattleDex?")) {
    writeDex([]);
    renderDex();
  }
});

// On load, only the form is visible.
updateDexCount();
showView("form");
