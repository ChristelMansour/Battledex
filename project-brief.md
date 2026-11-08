1. What are we actually building? (Scope)
A web app where you type in two fighters and get an AI generated verdict on who'd win, plus AI generated character art for both.

2. What's the smallest, simplest version worth shipping (MVP)?
Two text inputs, a Fight button, a working verdict with art, a loading state while we wait on the API, error states, and a basic BattleDex of saved fighters in localStorage. Type two fighters, get a real result, save a fighter if you want.

3. What are we building this with (tech stack)?
HTML, CSS, and vanilla JS for the frontend. Vercel serverless functions, run locally only. Claude's API for the verdict, with the output checked by a zod schema. OpenAI's image API for the character art later; this build uses placeholder images only. localStorage for saving BattleDex.

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
Character art (later, when real images are added; this build uses placeholders): one image per side. Group inputs (e.g. "10 cows vs 10 lions") still get one image per side, not one per unit. The image prompt for a group describes the whole group in one scene (e.g. "a herd of 10 cows").
Art style: every image the app creates follows one shared style template, including this build's placeholder images. For real art it is added to each fighter's image prompt: "Pink colors, centered, black outlines, light grey background. No text, words, letters, numbers, logos or watermarks, UI elements, borders, or frames of any kind."
Budget: free. This is a training project. Fake mode is on by default, so building and testing costs $0. Real verdicts use the cheapest Claude model (Haiku), paid from the free signup credit, and only for a few checks. No real images in this build: character art is always a placeholder and OpenAI is never called. Spending cap: $1 per month on Anthropic, with auto-reload turned off.
Fake mode: controlled by a server-side env var in .env.local (e.g. FAKE_API=true), on by default. api/fight.js still runs the full flow (input checks, rate limit, response shape, error handling) but returns a canned verdict instead of calling Claude (images are placeholders either way). Fake mode can also simulate each error type (verdict failure, image failure, moderation block) so error states can be tested for free. Real API calls only happen when fake mode is explicitly turned off.
BattleDex: saves individual fighters only, as { label, image }. No fight, winner, or reasoning data. Saved fighters can be deleted. From BattleDex you can jump back to the last fight result or start a new fight.
Image storage: images downsized/compressed client-side (canvas resize + JPEG/WebP quality) before saving to localStorage, to stay under browser storage quota. About 10+ saved fighters should fit.
