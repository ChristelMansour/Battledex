// Placeholder character art: a pastel square with the fighter's first letter.
// This build never calls a real image API (see project-brief.md: free training
// project). Real art can replace this later without changing the response shape.

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function placeholderImage(name) {
  const first = Array.from(name.trim())[0] || "?"; // handles emoji and non-English letters
  const letter = escapeXml(first.toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#e4dcf5"/>
  <text x="50" y="62" font-size="40" text-anchor="middle" font-family="sans-serif" fill="#8e6cc4">${letter}</text>
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
