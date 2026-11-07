// Stage 1: static UI shell. Uses fake data only. No network calls.

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

// Make a placeholder image (a pastel square with the fighter's first letter).
// Real AI art replaces this in Stage 3.
function placeholderImage(name) {
  const first = Array.from(name.trim())[0] || "?"; // works for emoji and non-English letters too
  // Escape characters that would break the SVG markup
  const letter = first.toUpperCase().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#e4dcf5"/>
      <text x="50" y="62" font-size="40" text-anchor="middle"
            font-family="sans-serif" fill="#8e6cc4">${letter}</text>
    </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Fill the result view with a fake verdict.
function showFakeResult(fighterA, fighterB) {
  const winner = Math.random() < 0.5 ? fighterA : fighterB;

  document.getElementById("winner-name").textContent = winner;
  document.getElementById("reasoning").textContent =
    `This is placeholder reasoning. In Stage 3, Claude will explain in 2-4 sentences why ${winner} wins.`;

  document.getElementById("image-a").src = placeholderImage(fighterA);
  document.getElementById("image-a").alt = fighterA;
  document.getElementById("caption-a").textContent = fighterA;

  document.getElementById("image-b").src = placeholderImage(fighterB);
  document.getElementById("image-b").alt = fighterB;
  document.getElementById("caption-b").textContent = fighterB;

  showView("result");
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showView("error");
}

// Fight button
document.getElementById("fight-form").addEventListener("submit", (event) => {
  event.preventDefault(); // stop the page from reloading

  const fighterA = document.getElementById("fighter-a").value.trim();
  const fighterB = document.getElementById("fighter-b").value.trim();

  if (!fighterA || !fighterB) {
    showError("Please enter both fighters.");
    return;
  }

  showView("loading");

  // Pretend we're waiting on the API. Stage 3 replaces this with a real call.
  setTimeout(() => showFakeResult(fighterA, fighterB), 1500);
});

// "New fight" and "Try again" both go back to the form.
document.querySelectorAll(".js-new-fight").forEach((button) => {
  button.addEventListener("click", () => showView("form"));
});

// On load, only the form is visible.
showView("form");
