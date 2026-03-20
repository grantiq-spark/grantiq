import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Serverless Runtime: Pro plan max 300s
export const config = {
              maxDuration: 300,
};

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
                                  const response = await client.messages.create({ ...baseParams, messages: history });
                                  lastResponse = response;

                    console.log("turn:", i, "stop_reason:", response.stop_reason);

                    if (response.stop_reason !== "pause_turn") {
                                        return res.status(200).json(response);
                    }

                    history = [...history, { role: "assistant", content: response.content }];
                }

                return res.status(200).json(lastResponse);
  } catch (err) {
                  console.error("Claude API error:", err?.status, err?.message || err);

                if (err?.status === 401) {
                                  return res.status(500).json({ error: "ANTHROPIC_API_KEY invalid" });
                }
                  if (err?.status === 429) {
                                    return res.status(429).json({ error: "Rate limit exceeded" });
                  }

                return res.status(500).json({ error: err.message || "Claude API error" });
  }
}
