// Placeholder character art. This build never calls a real image API (see
// project-brief.md: free training project). Real art can replace this later
// without changing the response shape.
//
// Follows the shared art style template (art-style.js): a pink shape with a
// black outline, centered on a light grey background. No text, letters or
// numbers, and no border or frame. The shape and shade come from the fighter's
// name, so different fighters usually look different.

import { ART_STYLE } from "./art-style.js";

// Simple string hash, so the same name always gets the same image.
function hash(text) {
  let h = 0;
  for (const ch of text.trim().toLowerCase()) {
    h = (h * 31 + ch.codePointAt(0)) >>> 0;
  }
  return h;
}

function starPoints(cx, cy, outer, inner, points = 5) {
  const coords = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return coords.join(" ");
}

// Each shape is centered on (50, 50) in a 100x100 view box.
const SHAPES = [
  (style) => `<circle cx="50" cy="50" r="30" ${style}/>`,
  (style) => `<path d="M50 80 C22 62 16 42 28 31 C38 23 48 28 50 37 C52 28 62 23 72 31 C84 42 78 62 50 80 Z" ${style}/>`,
  (style) => `<polygon points="${starPoints(50, 52, 33, 14)}" ${style}/>`,
  (style) => `<polygon points="50,18 80,50 50,82 20,50" ${style}/>`,
];

export function placeholderImage(name) {
  const h = hash(name);
  const fill = ART_STYLE.pinks[h % ART_STYLE.pinks.length];
  const shape = SHAPES[Math.floor(h / ART_STYLE.pinks.length) % SHAPES.length];
  const style = `fill="${fill}" stroke="${ART_STYLE.outline}" stroke-width="4" stroke-linejoin="round"`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${ART_STYLE.background}"/>
  ${shape(style)}
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
