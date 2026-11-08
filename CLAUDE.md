# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

BattleDex: type two fighters, get an AI verdict on who wins (Claude) with placeholder character images (real OpenAI art is deferred; this is a free training project), and save fighters to a local "BattleDex" collection. The folder and `package.json` name are still `BattleChristel`; the app is called BattleDex everywhere user-facing. Note "BattleDex" is also the name of the saved-fighters feature.

`project-brief.md` is the source of truth for requirements and decisions. `project-build.md` is the staged build plan. Work one stage at a time and only move on when the current stage's "Done when" check passes. Explicitly out of scope for now: deploying, a real backend / cross-device sync, and quick re-fight from saved fighters.

## Commands

- `npm start` — runs `vercel dev` (local only; never deploy in this build). Requires a Vercel login and the linked project in `.vercel/`.
- `npm run build` — intentional no-op (Vercel requires a build script).
- No test runner or linter is set up. Verification is manual per each stage's "Done when" check.

API keys live in `.env.local` (gitignored, never reachable from the browser because Vercel only serves `public/`).

**Fake mode is the default.** Fake mode is on unless `.env.local` sets `FAKE_API=false` (real mode also needs `ANTHROPIC_API_KEY`). It makes `api/fight.js` run its full flow but return a canned verdict (and simulate each error type) without calling Claude. In fake mode, a fighter named exactly `test:verdict-error`, `test:image-error` or `test:moderation` triggers that error. Testing must stay free: develop and test in fake mode, and only make real API calls when the user explicitly asks or a stage's "Done when" check requires a few (Stage 2 prompt tests, Stage 3 final check). Never call OpenAI: images are always placeholders in this build.

## Architecture

- **Frontend (`public/`)**: plain HTML/CSS/vanilla JS, no framework or bundler. `index.html` contains four views (form, loading, result, error) as `<section>`s; exactly one is visible at a time, toggled via the `hidden` attribute through `showView()` in `script.js`. Stage 4 adds a BattleDex view the same way.
- **Backend (`api/`)**: Vercel serverless functions. A single endpoint, `api/fight.js` (POST `{ fighterA, fighterB }`), per request: (1) validates input, (2) checks the rate limit (5 req/min per IP, 429), (3) gets the verdict from Claude via `messages.parse` + `zodOutputFormat` (structured outputs), (4) returns one server-generated placeholder image per side. Response: `{ winner: "A"|"B", reasoning, fighters: { A: { name, image }, B: { name, image } } }`, or `{ error: { type, message } }` where the frontend shows `message` as-is. Files under `api/_lib/` are shared helpers, not endpoints (Vercel skips `_`-prefixed paths).
- **Rate limit state** is a JSON file in the OS temp dir (`battledex-rate-limit.json`), not memory: `vercel dev` runs each request in a fresh process, so module-level state does not persist between requests. Delete the file to reset the limit while testing.
- **Judge prompt (`api/_lib/judge-prompt.js`)**: exports `JUDGE_SYSTEM_PROMPT` and `buildJudgeMessage(fighterA, fighterB)`. Fighter text is user input wrapped in `<fighter_a>`/`<fighter_b>` tags with `<>&` escaped; it must always be treated as data, never instructions. The verdict always names exactly one winner (no ties, even for identical fighters), with 2–4 playful sentences of reasoning.
- **Verdict output** is enforced with a zod schema (structured outputs), not JSON instructions in the prompt. `winner` is a corner (`"A"`/`"B"`), not a name, so mirror matches ("cow" vs "cow") stay unambiguous.
- **Models / cost** (when fake mode is off): Claude Haiku (`claude-haiku-5-5`) for the verdict, paid from the free signup credit; $1/month spending cap.
- **Images (deferred)**: placeholders only for now. When real art is added, every image prompt appends the shared pixel-art style template from `project-brief.md` §6 verbatim. Group inputs ("10 cows") produce one image per side describing the whole group, never one call per unit.
- **Errors**: the UI must show distinct messages for verdict failure, image failure, image blocked by moderation (simulated via fake mode for now), and rate limit hit; loading must never hang.
- **BattleDex storage**: localStorage array of `{ label, image }` only (no fight/winner data). Images are compressed client-side (canvas resize + JPEG/WebP) before saving so ~10+ fighters fit under quota.

## Design

Basic mobile-usable CSS until Stage 6, when the whole app gets a visual overhaul via Claude Design (the "Battleground Arcade" design project): feminine pastel palette (blush pink, lavender, cream, pastel purple), rounded cards, subtle animation. Don't invest in visual polish before then.
