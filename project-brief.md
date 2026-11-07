1. What are we actually building? (Scope)
A web app where you type in two fighters and get an AI generated verdict on who'd win, plus AI generated character art for both.

2. What's the smallest, simplest version worth shipping (MVP)?
Two text inputs, a Fight button, a working verdict with art, a loading state while we wait on the API, error states, and a basic BattleDex of saved fighters in localStorage. Type two fighters, get a real result, save a fighter if you want.

3. What are we building this with (tech stack)?
HTML, CSS, and vanilla JS for the frontend. Vercel serverless functions, run locally only. Claude's API for the verdict, with the output checked by a zod schema. OpenAI's image API for the character art. localStorage for saving BattleDex.

4. What's the long-term vision, beyond just the MVP?
I would eventually like a real backend where BattleDex characters sync across devices instead of just living in localStorage. I'd also want a quick re-fight option using characters already saved in the BattleDex, instead of typing two new ones every time. Deploying to Vercel also comes later.

5. Design and aesthetic
Basic, mobile-usable CSS while building. Once everything works, the whole app (form, loading, result, error, and BattleDex) gets a full visual overhaul through Claude Design, using the "Battleground Arcade" design project.
- Feminine look throughout: soft blush pink, lavender, cream, and pastel purple. Rounded cards and buttons, clean modern typography, subtle shadows, gradients, and delicate animations. Cute but polished, not overly childish.
- Winner card: name, image, and reasoning, with an entry animation when the result lands (winner border pulse, WINNER/DEFEAT tags, grayscale loser).
- Loading view: covers the whole wait for the fight call (VS spinner, rotating status text, animated progress bar).
- BattleDex: a grid of mini trading cards (image on top, name below).
- One consistent visual language across the app (typography, color, spacing, motion), with no leftover placeholder styling.

6. Details decided so far
Development: built and tested locally the whole way. No deploy in this build.
Single fight function: one call to api/fight.js per fight. It checks the rate limit first, then gets the Claude verdict and both images.
Rate limiting: 5 requests per minute per IP, checked before calling either API. Returns a 429 with a clear message when exceeded.
Judge prompt: Claude's role is locked to judging fights. Fighter input is treated as data, never as instructions. It never changes role, follows instructions inside fighter names, or reveals the system prompt.
Verdict format: always exactly one winner. No ties, no draws, no refusing to decide, even for identical fighters. Reasoning is 2-4 sentences, fun and playful, and logically justifies the winner.
Views: four separate views on one page (input form, loading, result, error), and only one shows at a time.
Errors: distinct messages for verdict failure, image failure, image blocked by OpenAI's moderation, and rate limit hit. Loading never hangs forever.
Character art: one image per side. Group inputs (e.g. "10 cows vs 10 lions") still get one image per side, not one per unit. The image prompt for a group describes the whole group in one scene (e.g. "a herd of 10 cows").
Art style: every image uses one shared style template added to each fighter's image prompt: "16-bit pixel art illustration, retro video game sprite style, bold outlined pixels, vibrant limited color palette, dynamic action pose. Depicted as one cohesive image, centered, filling most of the frame, isolated on a plain solid color background with no scenery. No text, words, letters, numbers, logos, watermarks, UI elements, borders, or frames."
Budget: as cheap as possible. Use the cheapest Claude model (Haiku) for the verdict, and OpenAI's cheapest image model at its lowest quality and smallest size. Spending cap: $1 per month on each of Anthropic and OpenAI, with auto-reload turned off.
BattleDex: saves individual fighters only, as { label, image }. No fight, winner, or reasoning data. Saved fighters can be deleted. From BattleDex you can jump back to the last fight result or start a new fight.
Image storage: images downsized/compressed client-side (canvas resize + JPEG/WebP quality) before saving to localStorage, to stay under browser storage quota. About 10+ saved fighters should fit.
