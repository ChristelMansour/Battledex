// Stage 3: the Fight button calls /api/fight for a real (or fake-mode) verdict.

const REQUEST_TIMEOUT_MS = 30_000; // loading never hangs forever

// The four views. Only one is ever visible at a time.
const views = {
  form: document.getElementById("view-form"),
  loading: document.getElementById("view-loading"),
  result: document.getElementById("view-result"),
  error: document.getElementById("view-error"),
};

// Hide every view, then show the one we want.
function showView(name) {
  for (const key in views) {
    views[key].hidden = key !== name;
  }
}

// Fill the result view from the API response.
function showResult(data) {
  const { A, B } = data.fighters;
  const winnerName = data.winner === "A" ? A.name : B.name;

  document.getElementById("winner-name").textContent = winnerName;
  document.getElementById("reasoning").textContent = data.reasoning;

  document.getElementById("image-a").src = A.image;
  document.getElementById("image-a").alt = A.name;
  document.getElementById("caption-a").textContent = A.name;

  document.getElementById("image-b").src = B.image;
  document.getElementById("image-b").alt = B.name;
  document.getElementById("caption-b").textContent = B.name;

  showView("result");
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showView("error");
}

// Call the fight API. Returns the parsed result, or throws an Error whose
// message is safe to show the user.
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
  if (!data || !data.fighters || (data.winner !== "A" && data.winner !== "B")) {
    throw new Error("The judge's verdict got garbled. Please try again.");
  }
  return data;
}

// Fight button
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
  showView("loading");

  try {
    showResult(await requestFight(fighterA, fighterB));
  } catch (err) {
    showError(err.message);
  } finally {
    fightButton.disabled = false;
  }
});

// "New fight" and "Try again" both go back to the form.
document.querySelectorAll(".js-new-fight").forEach((button) => {
  button.addEventListener("click", () => showView("form"));
});

// On load, only the form is visible.
showView("form");
