import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Serverless Runtime: Pro plan max 300s
export const config = {
  maxDuration: 300,
};

// Helper: sleep for ms
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { messages, system, tools, tool_choice, max_tokens = 2000 } = req.body;

    const baseParams = { model: "claude-sonnet-4-6", max_tokens };
    if (system) baseParams.system = system;
    if (tools) baseParams.tools = tools;
    if (tool_choice) baseParams.tool_choice = tool_choice;

    let history = Array.isArray(messages) ? [...messages] : [];
    let lastResponse = null;

    for (let i = 0; i < 6; i++) {
      let response;

      // Retry up to 3 times on rate limit (429)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await client.messages.create({ ...baseParams, messages: history });
          break;
        } catch (apiErr) {
          if (apiErr?.status === 429 && attempt < 2) {
            const wait = (attempt + 1) * 15;
            console.log(`Rate limited, waiting ${wait}s (attempt ${attempt + 1}/3)`);
            await sleep(wait * 1000);
            continue;
          }
          throw apiErr;
        }
      }

      lastResponse = response;
      if (response.stop_reason !== "pause_turn") {
        return res.status(200).json(response);
      }

      history = [...history, { role: "assistant", content: response.content }];
    }

    return res.status(200).json(lastResponse);
  } catch (err) {
    console.error("Claude API error:", err?.status, err?.message || err);

    if (err?.status === 401)
      return res.status(500).json({ error: "API \ud0a4\uac00 \uc720\ud6a8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4", code: "AUTH_ERROR" });
    if (err?.status === 429)
      return res.status(429).json({ error: "API \uc694\uccad \ud55c\ub3c4 \ucd08\uacfc. 1\ubd84 \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.", code: "RATE_LIMIT" });
    if (err?.status === 529)
      return res.status(503).json({ error: "Claude \uc11c\ubc84\uac00 \ud63c\uc7a1\ud569\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.", code: "OVERLOADED" });

    return res.status(500).json({ error: err.message || "Claude API \uc624\ub958", code: "UNKNOWN" });
  }
}
