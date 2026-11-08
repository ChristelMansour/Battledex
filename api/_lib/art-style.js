// Shared art style template (project-brief.md §6, project-build.md Stage 3).
// Every image the app creates must follow it:
//   - the placeholder images in this build (placeholder-image.js), and
//   - real AI art later, by appending this text to every image prompt.

export const ART_STYLE_TEMPLATE =
  "Pink colors, centered, black outlines, light grey background. " +
  "No text, words, letters, numbers, logos or watermarks, UI elements, borders, or frames of any kind.";

// Concrete values the placeholder images use to follow the template.
export const ART_STYLE = {
  background: "#e6e6e6", // light grey
  outline: "#000000", // black outlines
  pinks: ["#f8a5c2", "#f48fb1", "#ffc1d9", "#ec7aa8"], // pink colors
};
