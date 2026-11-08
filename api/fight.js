// POST /api/fight  { fighterA, fighterB }
//
// One call per fight (Stage 3 of project-build.md):
//   1. validate input
//   2. rate limit (5/min per IP) — before any API call
//   3. verdict from Claude, shape enforced by a zod schema via structured outputs
//   4. one placeholder image per side (no real image API in this build)
//
// Fake mode (default): no Claude call, canned verdict. Turn it off with
// FAKE_API=false in .env.local. In fake mode, a fighter named exactly
// "test:verdict-error", "test:image-error" or "test:moderation" simulates that error.
//
// Success:  200 { winner: "A" | "B", reasoning, fighters: { A: { name, image }, B: { name, image } } }
// Failure:  4xx/5xx { error: { type, message } }
//   type: bad_request | rate_limited | verdict_failed | image_failed | image_blocked

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { JUDGE_SYSTEM_PROMPT, buildJudgeMessage } from "./_lib/judge-prompt.js";
import { checkRateLimit } from "./_lib/rate-limit.js";
import { placeholderImage } from "./_lib/placeholder-image.js";

const MODEL = "claude-haiku-5-5"; // cheapest model, per project-brief.md
const MAX_NAME_LENGTH = 60; // matches maxlength on the form inputs

// The verdict shape. Winner is a corner ("A"/"B"), not a name, so mirror
// matches like "cow" vs "cow" are unambiguous.
const VerdictSchema = z.object({
  winner: z
    .enum(["A", "B"])
    .describe("The corner that wins: A for fighter_a, B for fighter_b."),
  reasoning: z
    .string()
    .describe("2 to 4 fun, playful sentences that logically justify why the winner wins."),
});

const isFakeMode = () => process.env.FAKE_API !== "false"; // on unless explicitly turned off

let client; // created lazily so fake mode never needs an API key
function getClient() {
  client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 });
  return client;
}

class FightError extends Error {
  constructor(status, type, message) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

function sendError(res, status, type, message) {
  res.status(status).json({ error: { type, message } });
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// --- Verdict -------------------------------------------------------------

async function realVerdict(fighterA, fighterB) {
  let response;
  try {
    response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: {
        effort: "low", // a short judgment call; keeps cost and latency down
        format: zodOutputFormat(VerdictSchema),
      },
      system: JUDGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildJudgeMessage(fighterA, fighterB) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic auth failed: is ANTHROPIC_API_KEY set in .env.local?");
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error("Anthropic rate limit hit:", err.message);
    } else if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${err.status}:`, err.message);
    } else {
      console.error("Verdict call failed:", err);
    }
    throw new FightError(502, "verdict_failed", "The judge couldn't reach a verdict. Please try again.");
  }

  if (response.stop_reason === "refusal") {
    console.error("Verdict refused:", response.stop_details?.category);
    throw new FightError(502, "verdict_failed", "The judge refused to rule on this fight. Try different fighters.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    console.error("Verdict missing or incomplete, stop_reason:", response.stop_reason);
    throw new FightError(502, "verdict_failed", "The judge's verdict got garbled. Please try again.");
  }

  return response.parsed_output;
}

async function fakeVerdict(fighterA, fighterB) {
  await new Promise((resolve) => setTimeout(resolve, 800)); // let the loading view show
  const winner = Math.random() < 0.5 ? "A" : "B";
  const [winnerName, loserName] = winner === "A" ? [fighterA, fighterB] : [fighterB, fighterA];
  return {
    winner,
    reasoning: `(Fake mode) ${winnerName} sizes up ${loserName}, finds an opening, and takes the round. Turn off fake mode for a real verdict from the judge.`,
  };
}

// --- Images (placeholders only in this build) ---------------------------

function getImages(fighterA, fighterB) {
  return { A: placeholderImage(fighterA), B: placeholderImage(fighterB) };
}

// --- Handler -------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "bad_request", "Use POST.");
  }

  // 1. Validate input
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const fighterA = typeof body.fighterA === "string" ? body.fighterA.trim() : "";
  const fighterB = typeof body.fighterB === "string" ? body.fighterB.trim() : "";
  if (!fighterA || !fighterB) {
    return sendError(res, 400, "bad_request", "Please enter both fighters.");
  }
  if (fighterA.length > MAX_NAME_LENGTH || fighterB.length > MAX_NAME_LENGTH) {
    return sendError(res, 400, "bad_request", `Fighter names can be at most ${MAX_NAME_LENGTH} characters.`);
  }

  // 2. Rate limit, before any API call
  const limit = checkRateLimit(getClientIp(req));
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    return sendError(
      res,
      429,
      "rate_limited",
      `Whoa, slow down! You can start 5 fights per minute. Try again in ${limit.retryAfterSeconds} seconds.`,
    );
  }

  const fake = isFakeMode();
  const simulate = (name) => fake && (fighterA === name || fighterB === name);

  try {
    // 3. Verdict
    if (simulate("test:verdict-error")) {
      throw new FightError(502, "verdict_failed", "(Simulated) The judge couldn't reach a verdict. Please try again.");
    }
    const verdict = fake ? await fakeVerdict(fighterA, fighterB) : await realVerdict(fighterA, fighterB);

    // 4. Images
    if (simulate("test:image-error")) {
      throw new FightError(502, "image_failed", "(Simulated) The fighters' portraits couldn't be drawn. Please try again.");
    }
    if (simulate("test:moderation")) {
      throw new FightError(422, "image_blocked", "(Simulated) The artist refused to draw one of these fighters. Try different fighters.");
    }
    const images = getImages(fighterA, fighterB);

    return res.status(200).json({
      winner: verdict.winner,
      reasoning: verdict.reasoning,
      fighters: {
        A: { name: fighterA, image: images.A },
        B: { name: fighterB, image: images.B },
      },
    });
  } catch (err) {
    if (err instanceof FightError) return sendError(res, err.status, err.type, err.message);
    console.error("Unexpected error in /api/fight:", err);
    return sendError(res, 500, "verdict_failed", "Something went wrong. Please try again.");
  }
}
